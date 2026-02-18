export type ExportOptions = {
    coverTitle: string | undefined;
    coverSubtitle: string | undefined;
    hideCoverFooter: boolean | undefined;
    headerLeftTemplate: string | undefined;
    headerRightTemplate: string | undefined;
    footerLeftTemplate: string | undefined;
    footerRightTemplate: string | undefined;
};

export type ExportTaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type ExportTask = {
    id: string;
    orgId: string;
    docsUrl: string;
    status: ExportTaskStatus;
    options: (ExportOptions & { version: "v1" }) | undefined;
    createdAt: string;
    startedAt: string | undefined;
    completedAt: string | undefined;
    fileName: string | undefined;
    sizeBytes: number | undefined;
    errorMessage: string | undefined;
    requesterName: string | undefined;
    notifyEmails: string[] | undefined;
};

export type ExportOptionKey = keyof ExportOptions;
export type ExportOptionSectionId = "cover" | "headersFooters";
export type ExportOptionKind = "coverText" | "boolean" | "template";
