import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

export type ExportOptions = {
    coverTitle: string | null | undefined;
    coverSubtitle: string | null | undefined;
    hideCoverFooter: boolean | undefined;
    headerLeftTemplate: string | undefined;
    headerRightTemplate: string | undefined;
    footerLeftTemplate: string | undefined;
    footerRightTemplate: string | undefined;
};
export type ExportTask = FdrAPI.pdfExport.PdfExportTask;
export type ExportTaskStatus = FdrAPI.pdfExport.PdfExportTaskStatus;

export type ExportOptionKey = keyof ExportOptions;
export type ExportOptionSectionId = "cover" | "headersFooters";
export type ExportOptionKind = "coverText" | "boolean" | "template";
