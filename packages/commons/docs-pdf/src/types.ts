export type PdfExportOptionsV1 = {
    version: "v1";
    coverTitle?: string;
    coverSubtitle?: string;
    hideCoverFooter?: boolean;
    headerLeftTemplate?: string;
    headerRightTemplate?: string;
    footerLeftTemplate?: string;
    footerRightTemplate?: string;
};

/**
 * Payload sent through SQS to kick off a PDF export job.
 * Should be consistent with the FDR type `PdfExportOptions`.
 */
export type PdfExportOptions = PdfExportOptionsV1;

export interface PdfExportSqsMessage {
    taskId: string;
    docsUrl: string;
    options?: PdfExportOptions;
    uploadUrl: string;
    callbackUrl: string;
}
