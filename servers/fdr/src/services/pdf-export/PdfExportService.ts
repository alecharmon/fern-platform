import type { PdfExportSqsMessage } from "@fern-api/docs-pdf";
import { FernEmailClient } from "@fern-platform/emails";
import { jwtVerify } from "jose";
import { v4 as uuidv4 } from "uuid";
import { UnauthorizedError } from "../../api/generated/api/resources/commons/errors";
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

export interface PdfExportService {
    createTask(params: CreatePdfExportTaskParams): Promise<PdfExportTask>;
    getTask(taskId: string): Promise<PdfExportTask | null>;
    listTasks(orgId: string, docsUrl: string, limit?: number): Promise<PdfExportTask[]>;
    updateTaskStatus(taskId: string, params: UpdatePdfExportTaskStatusRequest): Promise<PdfExportTask>;
    sendCompletionEmail(params: SendCompletionEmailParams): Promise<void>;
    getDownloadUrl(taskId: string): Promise<PdfExportDownloadResponse>;
    verifyDocsPdfExporterLambdaToken(authHeader: string | undefined): Promise<void>;
}

const BEARER_REGEX = /^bearer\s+/i;
const encoder = new TextEncoder();

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

    /**
     * Verifies the service-to-service JWT used by `docs-pdf-exporter-lambda` when calling back into FDR.
     */
    public async verifyDocsPdfExporterLambdaToken(authHeader: string | undefined) {
        if (!authHeader) {
            throw new UnauthorizedError("Authorization header was not specified");
        }

        const token = authHeader.replace(BEARER_REGEX, "");

        try {
            const { payload } = await jwtVerify(token, this.getJwtSecret(), {
                issuer: "https://buildwithfern.com",
                audience: "fdr"
            });

            if (payload.service !== "docs-pdf-exporter-lambda") {
                throw new UnauthorizedError("Invalid service token: expected service 'docs-pdf-exporter-lambda'");
            }
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                throw error;
            }
            throw new UnauthorizedError(`Invalid JWT token: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getJwtSecret(): Uint8Array {
        const secret = process.env.PDF_EXPORT_JWT_SECRET_KEY;
        if (!secret) {
            throw new Error("PDF_EXPORT_JWT_SECRET_KEY environment variable is not set");
        }
        return encoder.encode(secret);
    }
}
