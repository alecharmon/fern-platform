import {
    MAX_PDF_EXPORTS_PER_ORG_PER_DAY,
    PDF_EXPORT_RETENTION_DAYS,
    PDF_EXPORT_TASK_TIMEOUT_MS,
    type PdfExportSqsMessage
} from "@fern-api/docs-pdf";
import { FernEmailClient } from "@fern-platform/emails";
import { ORPCError } from "@orpc/server";
import { subDays, subMilliseconds } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { FdrApplication } from "../../app";
import type {
    PdfExportDownloadResponse,
    PdfExportOptions,
    PdfExportTask,
    UpdatePdfExportTaskStatusRequest
} from "../../controllers/pdf-export";
import { PdfExportSqsClient } from "./PdfExportSqsClient";
import { PdfExportStorage } from "./PdfExportStorage";

export interface CreatePdfExportTaskParams {
    orgId: string;
    docsUrl: string;
    productId?: string;
    versionId?: string;
    requesterName?: string;
    notifyEmails?: string[];
    options?: PdfExportOptions;
}

export interface SendCompletionEmailParams {
    taskId: string;
    docsUrl: string;
    completedAt?: string;
    requesterName?: string;
    notifyEmails?: string[];
}

export interface CleanupResult {
    expiredTasksDeleted: number;
    s3ObjectsDeleted: number;
    timedOutTasksFailed: number;
}

export interface PdfExportService {
    createTask(params: CreatePdfExportTaskParams): Promise<PdfExportTask>;
    getTask(taskId: string): Promise<PdfExportTask | null>;
    listTasks(orgId: string, docsUrl: string, limit?: number): Promise<PdfExportTask[]>;
    verifyDailyExportLimit(orgId: string): Promise<void>;
    updateTaskStatus(taskId: string, params: UpdatePdfExportTaskStatusRequest): Promise<PdfExportTask>;
    sendCompletionEmail(params: SendCompletionEmailParams): Promise<void>;
    getDownloadUrl(taskId: string): Promise<PdfExportDownloadResponse>;
    runCleanup(): Promise<CleanupResult>;
}

export class PdfExportServiceImpl implements PdfExportService {
    private storage: PdfExportStorage;
    private sqsClient: PdfExportSqsClient;
    private emailClient: FernEmailClient | undefined;

    public constructor(private readonly app: FdrApplication) {
        this.storage = new PdfExportStorage(app.config);
        this.sqsClient = new PdfExportSqsClient(app.config.pdfExportSqs);
        if (app.config.resendApiKey != null) {
            this.emailClient = new FernEmailClient({
                resendApiKey: app.config.resendApiKey,
                fromEmailAddress: "Fern <no-reply@updates.buildwithfern.com>"
            });
        } else {
            this.emailClient = undefined;
            this.app.logger.info("RESEND_API_KEY not set; PDF export completion emails will be skipped.");
        }
    }

    public async createTask(params: CreatePdfExportTaskParams): Promise<PdfExportTask> {
        const taskId = `pdfexp_${uuidv4()}`;
        const task = await this.app.dao.pdfExport().createTask({
            id: taskId,
            orgId: params.orgId,
            docsUrl: params.docsUrl,
            productId: params.productId,
            versionId: params.versionId,
            requesterName: params.requesterName,
            notifyEmails: params.notifyEmails,
            options: params.options
        });

        const s3Key = this.storage.getS3KeyForTask(taskId, params.docsUrl);
        const uploadUrl = await this.storage.getPresignedUploadUrl(s3Key);

        await this.sqsClient.sendMessage({
            taskId,
            docsUrl: params.docsUrl,
            productId: params.productId,
            versionId: params.versionId,
            options: (params.options ?? undefined) as PdfExportSqsMessage["options"],
            uploadUrl,
            callbackUrl: this.app.config.pdfExportCallbackBaseUrl
        });
        this.app.logger.info(`Queued PDF export task ${taskId} to SQS`);

        return this.app.dao.pdfExport().convertPdfExportTaskFromDb(task);
    }

    public async getTask(taskId: string): Promise<PdfExportTask | null> {
        const task = await this.app.dao.pdfExport().getTask(taskId);
        if (task == null) {
            return null;
        }
        return this.app.dao.pdfExport().convertPdfExportTaskFromDb(task);
    }

    public async listTasks(orgId: string, docsUrl: string, limit?: number): Promise<PdfExportTask[]> {
        const tasks = await this.app.dao.pdfExport().listTasks(orgId, docsUrl, limit);
        return tasks.map((task) => this.app.dao.pdfExport().convertPdfExportTaskFromDb(task));
    }

    public async verifyDailyExportLimit(orgId: string): Promise<void> {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const count = await this.app.dao.pdfExport().countNonFailedTasksCreatedSince(orgId, twentyFourHoursAgo);
        if (count >= MAX_PDF_EXPORTS_PER_ORG_PER_DAY) {
            throw new ORPCError("TOO_MANY_REQUESTS", {
                message: `Daily PDF export limit reached (${MAX_PDF_EXPORTS_PER_ORG_PER_DAY} per organization). Please try again later.`
            });
        }
    }

    public async updateTaskStatus(taskId: string, params: UpdatePdfExportTaskStatusRequest): Promise<PdfExportTask> {
        const task = await this.app.dao.pdfExport().updateTaskStatus(taskId, {
            status: params.status,
            startedAt: params.startedAt != null ? new Date(params.startedAt) : undefined,
            completedAt: params.completedAt != null ? new Date(params.completedAt) : undefined,
            s3Key: params.s3Key ?? undefined,
            fileName: params.fileName ?? undefined,
            sizeBytes: params.sizeBytes ?? undefined,
            errorMessage: params.errorMessage ?? undefined
        });
        return this.app.dao.pdfExport().convertPdfExportTaskFromDb(task);
    }

    /**
     * Generates a download URL and sends the completion notification email.
     */
    public async sendCompletionEmail(params: SendCompletionEmailParams): Promise<void> {
        if (this.emailClient == null) {
            return;
        }

        const userFirstName = params.requesterName?.split(/\s+/)[0] ?? "there";
        const s3Key = this.storage.getS3KeyForTask(params.taskId, params.docsUrl);
        const download = await this.storage.getPresignedDownloadUrl(s3Key);

        if (params.notifyEmails == null || params.notifyEmails.length === 0) {
            return;
        }

        try {
            await this.emailClient.sendEmail({
                to: params.notifyEmails,
                template: {
                    type: "pdf-export-complete",
                    props: {
                        userFirstName,
                        docsSiteUrl: params.docsUrl,
                        exportTimestamp: params.completedAt != null ? new Date(params.completedAt) : undefined,
                        downloadUrl: download.url,
                        downloadUrlExpiresInHours: Math.floor(download.expiresInSeconds / 3600)
                    }
                }
            });
        } catch (e) {
            this.app.logger.error("Failed to send PDF export completion email", {
                taskId: params.taskId,
                toEmails: params.notifyEmails,
                error: e instanceof Error ? e.message : String(e)
            });
        }
    }

    public async getDownloadUrl(taskId: string): Promise<PdfExportDownloadResponse> {
        const task = await this.app.dao.pdfExport().getTask(taskId);
        if (task == null) {
            throw new Error(`PDF export task ${taskId} not found`);
        }

        if (task.status !== "COMPLETED" || task.s3Key == null) {
            throw new Error(`PDF export task ${taskId} is not completed`);
        }

        const download = await this.storage.getPresignedDownloadUrl(task.s3Key);

        return {
            downloadUrl: download.url,
            fileName: task.fileName ?? `${task.docsUrl.replace(/\./g, "-")}.pdf`,
            sizeBytes: task.sizeBytes ?? 0
        };
    }

    public async runCleanup(): Promise<CleanupResult> {
        const { expiredTasksDeleted, s3ObjectsDeleted } = await this.deleteExpiredExports();
        const timedOutTasksFailed = await this.failTimedOutTasks();
        return { expiredTasksDeleted, s3ObjectsDeleted, timedOutTasksFailed };
    }

    private async deleteExpiredExports(): Promise<Pick<CleanupResult, "expiredTasksDeleted" | "s3ObjectsDeleted">> {
        const retentionCutoff = subDays(new Date(), PDF_EXPORT_RETENTION_DAYS);
        const expiredTasks = await this.app.dao.pdfExport().findTasksCreatedBefore(retentionCutoff);

        if (expiredTasks.length === 0) {
            return { expiredTasksDeleted: 0, s3ObjectsDeleted: 0 };
        }

        const s3Keys = expiredTasks.map((t) => t.s3Key).filter((key) => key != null);

        const { deletedCount: s3ObjectsDeleted, errors } = await this.storage.deleteObjects(s3Keys);

        if (errors.length > 0) {
            this.app.logger.error(`Failed to delete ${errors.length} S3 objects during PDF export cleanup`, {
                errors
            });
        }

        const expiredTasksDeleted = await this.app.dao.pdfExport().deleteTasksByIds(expiredTasks.map((t) => t.id));

        return { expiredTasksDeleted, s3ObjectsDeleted };
    }

    private async failTimedOutTasks(): Promise<number> {
        return this.app.dao.pdfExport().markTimedOutTasksAsFailed({
            startedBefore: subMilliseconds(new Date(), PDF_EXPORT_TASK_TIMEOUT_MS)
        });
    }
}
