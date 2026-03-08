import type {
    CreatePdfExportTaskInputSchema,
    GetPdfExportDownloadUrlInputSchema,
    GetPdfExportTaskInputSchema,
    ListPdfExportTasksInputSchema,
    ListPdfExportTasksResponseSchema,
    PdfExportDownloadResponseSchema,
    PdfExportOptions,
    PdfExportTaskSchema,
    UpdatePdfExportTaskInputSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

export function createPdfExportRouter(app: FdrApplication) {
    const createTask = os
        .route({ method: "POST", path: "/task" })
        .input(z.custom<z.infer<typeof CreatePdfExportTaskInputSchema>>())
        .output(z.custom<z.infer<typeof PdfExportTaskSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });

            await app.services.pdfExport.verifyDailyExportLimit(input.orgId);

            const userEmail = await app.services.auth.getUserEmailFromAuthHeader({
                authHeader: authorization
            });

            const task = await app.services.pdfExport.createTask({
                orgId: input.orgId,
                docsUrl: input.docsUrl,
                productId: input.productId ?? undefined,
                versionId: input.versionId ?? undefined,
                requesterName: input.requesterName ?? undefined,
                notifyEmails: userEmail != null ? [userEmail] : undefined,
                options: (input.options ?? undefined) as PdfExportOptions | undefined
            });
            return task;
        });

    const listTasks = os
        .route({ method: "GET", path: "/tasks" })
        .input(z.custom<z.infer<typeof ListPdfExportTasksInputSchema>>())
        .output(z.custom<z.infer<typeof ListPdfExportTasksResponseSchema>>())
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
        .input(z.custom<z.infer<typeof GetPdfExportTaskInputSchema>>())
        .output(z.custom<z.infer<typeof PdfExportTaskSchema>>())
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
        .input(z.custom<z.infer<typeof UpdatePdfExportTaskInputSchema>>())
        .output(z.custom<z.infer<typeof PdfExportTaskSchema>>())
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
                    completedAt: updatedTask.completedAt ?? undefined,
                    requesterName: updatedTask.requesterName ?? undefined,
                    notifyEmails: updatedTask.notifyEmails ?? undefined
                });
            }
            return updatedTask;
        });

    const getDownloadUrl = os
        .route({ method: "GET", path: "/task/{taskId}/download-url" })
        .input(z.custom<z.infer<typeof GetPdfExportDownloadUrlInputSchema>>())
        .output(z.custom<z.infer<typeof PdfExportDownloadResponseSchema>>())
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
