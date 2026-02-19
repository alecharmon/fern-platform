import { oc } from "@orpc/contract";
import * as z from "zod";

export const PdfExportOptionsV1Schema = z.object({
    coverTitle: z.string().nullish(),
    coverSubtitle: z.string().nullish(),
    hideCoverFooter: z.boolean().nullish(),
    headerLeftTemplate: z.string().nullish(),
    headerRightTemplate: z.string().nullish(),
    footerLeftTemplate: z.string().nullish(),
    footerRightTemplate: z.string().nullish()
});

export const PdfExportOptionsSchema = z.discriminatedUnion("version", [
    z.object({ version: z.literal("v1") }).merge(PdfExportOptionsV1Schema)
]);

export const PdfExportTaskStatusSchema = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]);

export const PdfExportTaskSchema = z.object({
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
    productId: z.string().nullish(),
    versionId: z.string().nullish(),
    requesterName: z.string().nullish(),
    notifyEmails: z.array(z.string()).nullish(),
    options: PdfExportOptionsSchema.nullish()
});

export const ListPdfExportTasksInputSchema = z.object({
    orgId: z.string(),
    docsUrl: z.string(),
    limit: z.coerce.number().nullish()
});

export const GetPdfExportTaskInputSchema = z.object({
    taskId: z.string()
});

export const UpdatePdfExportTaskInputSchema = z.object({
    taskId: z.string(),
    status: PdfExportTaskStatusSchema,
    startedAt: z.string().nullish(),
    completedAt: z.string().nullish(),
    s3Key: z.string().nullish(),
    fileName: z.string().nullish(),
    sizeBytes: z.number().nullish(),
    errorMessage: z.string().nullish()
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
