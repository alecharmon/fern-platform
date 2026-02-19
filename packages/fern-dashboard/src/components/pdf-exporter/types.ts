import type { PdfExportOptionsV1, PdfExportTask, PdfExportTaskStatus } from "@fern-api/fdr-sdk/orpc-client";

type StripNull<T> = { [K in keyof T]: Exclude<T[K], null> };

export type ExportOptions = StripNull<PdfExportOptionsV1>;
export type ExportTaskStatus = PdfExportTaskStatus;
export type ExportTask = PdfExportTask;

export type ExportOptionKey = keyof ExportOptions;
export type ExportOptionSectionId = "cover" | "headersFooters";
export type ExportOptionKind = "coverText" | "boolean" | "template";
