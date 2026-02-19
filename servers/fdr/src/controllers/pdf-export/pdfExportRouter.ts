import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import type { PdfExportOptions } from "./types";

const PdfExportOptionsV1Schema = z.object({
    coverTitle: z.string().nullish(),
    coverSubtitle: z.string().nullish(),
    hideCoverFooter: z.boolean().nullish(),
    headerLeftTemplate: z.string().nullish(),
    headerRightTemplate: z.string().nullish(),
    footerLeftTemplate: z.string().nullish(),
    footerRightTemplate: z.string().nullish()
});

const PdfExportOptionsSchema = z.discriminatedUnion("version", [
    z.object({ version: z.literal("v1") }).merge(PdfExportOptionsV1Schema)
]);

const PdfExportTaskStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

const PdfExportTaskSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    docsUrl: z.string(),
    productId: z.string().nullish(),
    versionId: z.string().nullish(),
    requesterName: z.string().nullish(),
    notifyEmails: z.array(z.string()).nullish(),
    status: PdfExportTaskStatusSchema,
    options: PdfExportOptionsSchema.nullish(),
    createdAt: z.string(),
    startedAt: z.string().nullish(),
    completedAt: z.string().nullish(),
    fileName: z.string().nullish(),
    sizeBytes: z.number().nullish(),
    errorMessage: z.string().nullish()
});

const ListPdfExportTasksResponseSchema = z.object({
    tasks: z.array(PdfExportTaskSchema)
});

const PdfExportDownloadResponseSchema = z.object({
    downloadUrl: z.string(),
    fileName: z.string(),
    sizeBytes: z.number()
});

export function createPdfExportRouter(app: FdrApplication) {
    const createTask = os
        .route({ method: "POST", path: "/task" })
        .input(
            z.object({
                orgId: z.string(),
                docsUrl: z.string(),
                productId: z.string().nullish(),
                versionId: z.string().nullish(),
                requesterName: z.string().nullish(),
                notifyEmails: z.array(z.string()).nullish(),
                options: PdfExportOptionsSchema.nullish()
            })
        )
        .output(PdfExportTaskSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });
            const task = await app.services.pdfExport.createTask({
                orgId: input.orgId,
                docsUrl: input.docsUrl,
                productId: input.productId ?? undefined,
                versionId: input.versionId ?? undefined,
                requesterName: input.requesterName ?? undefined,
                notifyEmails: input.notifyEmails ?? undefined,
                options: (input.options ?? undefined) as PdfExportOptions | undefined
            });
            return task;
        });

    const listTasks = os
        .route({ method: "GET", path: "/tasks" })
        .input(
            z.object({
                orgId: z.string(),
                docsUrl: z.string(),
                limit: z.coerce.number().nullish()
            })
        )
        .output(ListPdfExportTasksResponseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });
            let limit: number | undefined;
            if (input.limit != null) {
                const parsed = Number(input.limit);
                if (Number.isFinite(parsed)) {
                    limit = Math.max(1, Math.min(50, Math.trunc(parsed)));
                }
            }
            const tasks = await app.services.pdfExport.listTasks(input.orgId, input.docsUrl, limit);
            return { tasks };
        });

    const getTask = os
        .route({ method: "GET", path: "/task/{taskId}" })
        .input(
            z.object({
                taskId: z.string()
            })
        )
        .output(PdfExportTaskSchema)
        .handler(async ({ input, context }) => {
            const task = await app.services.pdfExport.getTask(input.taskId);
            if (task == null) {
                throw new ORPCError("NOT_FOUND");
            }
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: task.orgId
            });
            return task;
        });

    const updateTask = os
        .route({ method: "POST", path: "/task/{taskId}" })
        .input(
            z.object({
                taskId: z.string(),
                status: PdfExportTaskStatusSchema,
                startedAt: z.string().nullish(),
                completedAt: z.string().nullish(),
                s3Key: z.string().nullish(),
                fileName: z.string().nullish(),
                sizeBytes: z.number().nullish(),
                errorMessage: z.string().nullish()
            })
        )
        .output(PdfExportTaskSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.pdfExport.verifyDocsPdfExporterLambdaToken(authorization);
            const prevTask = await app.services.pdfExport.getTask(input.taskId);
            if (prevTask == null) {
                throw new ORPCError("NOT_FOUND");
            }
            const updatedTask = await app.services.pdfExport.updateTaskStatus(input.taskId, {
                status: input.status,
                startedAt: input.startedAt ?? undefined,
                completedAt: input.completedAt ?? undefined,
                s3Key: input.s3Key ?? undefined,
                fileName: input.fileName ?? undefined,
                sizeBytes: input.sizeBytes ?? undefined,
                errorMessage: input.errorMessage ?? undefined
            });
            if (prevTask.status !== "COMPLETED" && updatedTask.status === "COMPLETED") {
                await app.services.pdfExport.sendCompletionEmail({
                    taskId: input.taskId,
                    docsUrl: updatedTask.docsUrl,
                    completedAt: updatedTask.completedAt,
                    requesterName: updatedTask.requesterName,
                    notifyEmails: updatedTask.notifyEmails
                });
            }
            return updatedTask;
        });

    const getDownloadUrl = os
        .route({ method: "GET", path: "/task/{taskId}/download-url" })
        .input(
            z.object({
                taskId: z.string()
            })
        )
        .output(PdfExportDownloadResponseSchema)
        .handler(async ({ input, context }) => {
            const task = await app.services.pdfExport.getTask(input.taskId);
            if (task == null) {
                throw new ORPCError("NOT_FOUND");
            }
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: task.orgId
            });
            if (task.status !== "COMPLETED") {
                throw new ORPCError("BAD_REQUEST");
            }
            const downloadResponse = await app.services.pdfExport.getDownloadUrl(input.taskId);
            return downloadResponse;
        });

    return { createTask, listTasks, getTask, updateTask, getDownloadUrl };
}
