import { oc } from "@orpc/contract";
import * as z from "zod";

export const PdfExportOptionsV1Schema = z.object({
    coverTitle: z.string().optional(),
    coverSubtitle: z.string().optional(),
    hideCoverFooter: z.boolean().optional(),
    headerLeftTemplate: z.string().optional(),
    headerRightTemplate: z.string().optional(),
    footerLeftTemplate: z.string().optional(),
    footerRightTemplate: z.string().optional()
});

export const PdfExportOptionsSchema = z.discriminatedUnion("version", [
    z.object({ version: z.literal("v1") }).merge(PdfExportOptionsV1Schema)
]);

export const PdfExportTaskStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

export const PdfExportTaskSchema = z.object({
    id: z.string(),
    orgId: z.string(),
    docsUrl: z.string(),
    productId: z.string().optional(),
    versionId: z.string().optional(),
    requesterName: z.string().optional(),
    notifyEmails: z.array(z.string()).optional(),
    status: PdfExportTaskStatusSchema,
    options: PdfExportOptionsSchema.optional(),
    createdAt: z.string(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    fileName: z.string().optional(),
    sizeBytes: z.number().optional(),
    errorMessage: z.string().optional()
});

export const ListPdfExportTasksResponseSchema = z.object({
    tasks: z.array(PdfExportTaskSchema)
});

export const PdfExportDownloadResponseSchema = z.object({
    downloadUrl: z.string(),
    fileName: z.string(),
    sizeBytes: z.number()
});

export const CreatePdfExportTaskInputSchema = z.object({
    orgId: z.string(),
    docsUrl: z.string(),
    productId: z.string().optional(),
    versionId: z.string().optional(),
    requesterName: z.string().optional(),
    notifyEmails: z.array(z.string()).optional(),
    options: PdfExportOptionsSchema.optional()
});

export const ListPdfExportTasksInputSchema = z.object({
    orgId: z.string(),
    docsUrl: z.string(),
    limit: z.coerce.number().optional()
});

export const GetPdfExportTaskInputSchema = z.object({
    taskId: z.string()
});

export const UpdatePdfExportTaskInputSchema = z.object({
    taskId: z.string(),
    status: PdfExportTaskStatusSchema,
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    s3Key: z.string().optional(),
    fileName: z.string().optional(),
    sizeBytes: z.number().optional(),
    errorMessage: z.string().optional()
});

export const GetPdfExportDownloadUrlInputSchema = z.object({
    taskId: z.string()
});

export type PdfExportTaskId = string;
export type PdfExportOptionsV1 = z.infer<typeof PdfExportOptionsV1Schema>;
export type PdfExportOptions = z.infer<typeof PdfExportOptionsSchema>;
export type PdfExportTaskStatus = z.infer<typeof PdfExportTaskStatusSchema>;
export type PdfExportTask = z.infer<typeof PdfExportTaskSchema>;
export type ListPdfExportTasksResponse = z.infer<typeof ListPdfExportTasksResponseSchema>;
export type PdfExportDownloadResponse = z.infer<typeof PdfExportDownloadResponseSchema>;
export type CreatePdfExportTaskInput = z.infer<typeof CreatePdfExportTaskInputSchema>;
export type ListPdfExportTasksInput = z.infer<typeof ListPdfExportTasksInputSchema>;
export type UpdatePdfExportTaskInput = z.infer<typeof UpdatePdfExportTaskInputSchema>;
export type UpdatePdfExportTaskStatusRequest = Omit<UpdatePdfExportTaskInput, "taskId">;

export const pdfExportContract = {
    createTask: oc
        .route({ method: "POST", path: "/task" })
        .input(CreatePdfExportTaskInputSchema)
        .output(PdfExportTaskSchema),

    listTasks: oc
        .route({ method: "GET", path: "/tasks" })
        .input(ListPdfExportTasksInputSchema)
        .output(ListPdfExportTasksResponseSchema),

    getTask: oc
        .route({ method: "GET", path: "/task/{taskId}" })
        .input(GetPdfExportTaskInputSchema)
        .output(PdfExportTaskSchema),

    updateTask: oc
        .route({ method: "POST", path: "/task/{taskId}" })
        .input(UpdatePdfExportTaskInputSchema)
        .output(PdfExportTaskSchema),

    getDownloadUrl: oc
        .route({ method: "GET", path: "/task/{taskId}/download-url" })
        .input(GetPdfExportDownloadUrlInputSchema)
        .output(PdfExportDownloadResponseSchema)
};
