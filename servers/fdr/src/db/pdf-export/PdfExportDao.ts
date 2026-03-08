import {
    type PdfExportOptions,
    PdfExportOptionsSchema,
    type PdfExportTaskStatus,
    type PdfExportTask as PdfExportTaskType
} from "@fern-api/fdr-sdk/orpc-client";
import { assertNever } from "@fern-api/ui-core-utils";
import type { PdfExportTask, Prisma, PrismaClient } from "@prisma/client";

export interface CreatePdfExportTaskParams {
    id: string;
    orgId: string;
    docsUrl: string;
    productId?: string;
    versionId?: string;
    requesterName?: string;
    notifyEmails?: string[];
    options?: PdfExportOptions;
}

export interface UpdatePdfExportTaskStatusParams {
    status: PdfExportTaskStatus;
    startedAt?: Date;
    completedAt?: Date;
    s3Key?: string;
    fileName?: string;
    sizeBytes?: number;
    errorMessage?: string;
}

export interface PdfExportDao {
    createTask(params: CreatePdfExportTaskParams): Promise<PdfExportTask>;
    getTask(id: string): Promise<PdfExportTask | null>;
    listTasks(orgId: string, docsUrl: string, limit?: number): Promise<PdfExportTask[]>;
    countNonFailedTasksCreatedSince(orgId: string, since: Date): Promise<number>;
    updateTaskStatus(id: string, params: UpdatePdfExportTaskStatusParams): Promise<PdfExportTask>;
    convertPdfExportTaskFromDb(task: PdfExportTask): PdfExportTaskType;
    convertPdfExportOptionsFromDb(options: PdfExportTask["options"]): PdfExportOptions | undefined;
    convertPdfExportOptionsToDb(opts: PdfExportOptions | undefined): Prisma.InputJsonValue | undefined;
}

export class PdfExportDaoImpl implements PdfExportDao {
    constructor(private readonly prisma: PrismaClient) {}

    public async createTask(params: CreatePdfExportTaskParams): Promise<PdfExportTask> {
        const options = this.convertPdfExportOptionsToDb(params.options);
        return this.prisma.pdfExportTask.create({
            data: {
                id: params.id,
                orgId: params.orgId,
                docsUrl: params.docsUrl,
                ...(params.productId != null ? { productId: params.productId } : {}),
                ...(params.versionId != null ? { versionId: params.versionId } : {}),
                ...(params.requesterName != null ? { requesterName: params.requesterName } : {}),
                ...(params.notifyEmails != null && params.notifyEmails.length > 0
                    ? { notifyEmails: params.notifyEmails }
                    : {}),
                ...(options !== undefined ? { options } : {}),
                status: "PENDING"
            }
        });
    }

    public async getTask(id: string): Promise<PdfExportTask | null> {
        return this.prisma.pdfExportTask.findUnique({
            where: { id }
        });
    }

    public async listTasks(orgId: string, docsUrl: string, limit: number = 10): Promise<PdfExportTask[]> {
        return this.prisma.pdfExportTask.findMany({
            where: {
                orgId,
                docsUrl
            },
            orderBy: {
                createdAt: "desc"
            },
            take: limit
        });
    }

    public async countNonFailedTasksCreatedSince(orgId: string, since: Date): Promise<number> {
        return this.prisma.pdfExportTask.count({
            where: {
                orgId,
                createdAt: { gte: since },
                status: { not: "FAILED" }
            }
        });
    }

    public async updateTaskStatus(id: string, params: UpdatePdfExportTaskStatusParams): Promise<PdfExportTask> {
        return this.prisma.pdfExportTask.update({
            where: { id },
            data: {
                status: params.status,
                startedAt: params.startedAt,
                completedAt: params.completedAt,
                s3Key: params.s3Key,
                fileName: params.fileName,
                sizeBytes: params.sizeBytes,
                errorMessage: params.errorMessage
            }
        });
    }

    public convertPdfExportTaskFromDb(task: PdfExportTask): PdfExportTaskType {
        return {
            id: task.id,
            orgId: task.orgId,
            docsUrl: task.docsUrl,
            productId: task.productId ?? undefined,
            versionId: task.versionId ?? undefined,
            status: task.status,
            options: this.convertPdfExportOptionsFromDb(task.options),
            createdAt: task.createdAt.toISOString(),
            startedAt: task.startedAt?.toISOString(),
            completedAt: task.completedAt?.toISOString(),
            fileName: task.fileName ?? undefined,
            sizeBytes: task.sizeBytes ?? undefined,
            errorMessage: task.errorMessage ?? undefined,
            requesterName: task.requesterName ?? undefined,
            notifyEmails: task.notifyEmails
        };
    }

    public convertPdfExportOptionsFromDb(options: PdfExportTask["options"]): PdfExportOptions | undefined {
        const parsed = PdfExportOptionsSchema.safeParse(options);
        if (!parsed.success) {
            return undefined;
        }
        const { data } = parsed;
        switch (data.version) {
            case "v1":
                return {
                    version: "v1",
                    coverTitle: data.coverTitle,
                    coverSubtitle: data.coverSubtitle,
                    hideCoverFooter: data.hideCoverFooter,
                    headerLeftTemplate: data.headerLeftTemplate,
                    headerRightTemplate: data.headerRightTemplate,
                    footerLeftTemplate: data.footerLeftTemplate,
                    footerRightTemplate: data.footerRightTemplate
                };
            default:
                assertNever(data.version);
        }
    }

    public convertPdfExportOptionsToDb(opts: PdfExportOptions | undefined): Prisma.InputJsonValue | undefined {
        if (opts == null) {
            return undefined;
        }
        switch (opts.version) {
            case "v1": {
                return {
                    version: "v1",
                    ...(opts.coverTitle !== undefined ? { coverTitle: opts.coverTitle } : {}),
                    ...(opts.coverSubtitle !== undefined ? { coverSubtitle: opts.coverSubtitle } : {}),
                    ...(opts.hideCoverFooter !== undefined ? { hideCoverFooter: opts.hideCoverFooter } : {}),
                    ...(opts.headerLeftTemplate !== undefined ? { headerLeftTemplate: opts.headerLeftTemplate } : {}),
                    ...(opts.headerRightTemplate !== undefined
                        ? { headerRightTemplate: opts.headerRightTemplate }
                        : {}),
                    ...(opts.footerLeftTemplate !== undefined ? { footerLeftTemplate: opts.footerLeftTemplate } : {}),
                    ...(opts.footerRightTemplate !== undefined ? { footerRightTemplate: opts.footerRightTemplate } : {})
                } satisfies PdfExportOptions;
            }
            default:
                assertNever(opts.version);
        }
    }
}
