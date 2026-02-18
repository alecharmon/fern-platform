export type PdfExportTaskId = string;

export type PdfExportTaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface PdfExportOptionsV1 {
    coverTitle: string | undefined;
    coverSubtitle: string | undefined;
    hideCoverFooter: boolean | undefined;
    headerLeftTemplate: string | undefined;
    headerRightTemplate: string | undefined;
    footerLeftTemplate: string | undefined;
    footerRightTemplate: string | undefined;
}

export type PdfExportOptions = PdfExportOptions.V1;

export namespace PdfExportOptions {
    export interface V1 extends PdfExportOptionsV1 {
        version: "v1";
    }
}

export interface PdfExportTask {
    id: PdfExportTaskId;
    orgId: string;
    docsUrl: string;
    status: PdfExportTaskStatus;
    options: PdfExportOptions | undefined;
    createdAt: string;
    startedAt: string | undefined;
    completedAt: string | undefined;
    fileName: string | undefined;
    sizeBytes: number | undefined;
    errorMessage: string | undefined;
    requesterName: string | undefined;
    notifyEmails: string[] | undefined;
}

export interface ListPdfExportTasksResponse {
    tasks: PdfExportTask[];
}

export interface UpdatePdfExportTaskStatusRequest {
    status: PdfExportTaskStatus;
    startedAt: string | undefined;
    completedAt: string | undefined;
    s3Key: string | undefined;
    fileName: string | undefined;
    sizeBytes: number | undefined;
    errorMessage: string | undefined;
}

export interface PdfExportDownloadResponse {
    downloadUrl: string;
    fileName: string;
    sizeBytes: number;
}
