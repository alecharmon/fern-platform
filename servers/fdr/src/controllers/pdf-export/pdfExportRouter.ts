import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import type { PdfExportOptions } from "./types";

const PdfExportOptionsV1Schema = z.object({
    coverTitle: z.string().optional(),
    coverSubtitle: z.string().optional(),
    hideCoverFooter: z.boolean().optional(),
    headerLeftTemplate: z.string().optional(),
    headerRightTemplate: z.string().optional(),
    footerLeftTemplate: z.string().optional(),
    footerRightTemplate: z.string().optional()
});

const PdfExportOptionsSchema = z.discriminatedUnion("version", [
    z.object({ version: z.literal("v1") }).merge(PdfExportOptionsV1Schema)
]);

const PdfExportTaskStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

const PdfExportTaskSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    docsUrl: z.string(),
    status: PdfExportTaskStatusSchema,
    options: PdfExportOptionsSchema.optional(),
    createdAt: z.string(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    fileName: z.string().optional(),
    sizeBytes: z.number().optional(),
    errorMessage: z.string().optional(),
    requesterName: z.string().optional(),
    notifyEmails: z.array(z.string()).optional()
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
                requesterName: z.string().optional(),
                notifyEmails: z.array(z.string()).optional(),
                options: PdfExportOptionsSchema.optional()
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
                requesterName: input.requesterName,
                notifyEmails: input.notifyEmails,
                options: input.options as PdfExportOptions | undefined
            });
            return task;
        });

    const listTasks = os
        .route({ method: "GET", path: "/tasks" })
        .input(
            z.object({
                orgId: z.string(),
                docsUrl: z.string(),
                limit: z.coerce.number().optional()
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
                startedAt: z.string().optional(),
                completedAt: z.string().optional(),
                s3Key: z.string().optional(),
                fileName: z.string().optional(),
                sizeBytes: z.number().optional(),
                errorMessage: z.string().optional()
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
                startedAt: input.startedAt,
                completedAt: input.completedAt,
                s3Key: input.s3Key,
                fileName: input.fileName,
                sizeBytes: input.sizeBytes,
                errorMessage: input.errorMessage
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
