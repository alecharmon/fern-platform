import {
    createDashboardClient,
    createFdrORPCClient,
    createPdfExportClient,
    type DashboardClient,
    type FdrORPCClient,
    type PdfExportClient
} from "@fern-api/fdr-sdk/orpc-client";

export function getFdrBaseUrl(): string {
    if (process.env.FDR_SERVER_URL == null) {
        throw new Error("FDR_SERVER_URL is not defined in the current environment");
    }
    return process.env.FDR_SERVER_URL;
}

export function getFdrClient({ token }: { token: string }): FdrORPCClient {
    return createFdrORPCClient({
        baseUrl: getFdrBaseUrl(),
        token
    });
}

export function getOrpcFdrClient({ token }: { token: string }): {
    dashboard: DashboardClient;
    pdfExport: PdfExportClient;
} {
    const baseUrl = getFdrBaseUrl();
    return {
        dashboard: createDashboardClient({ baseUrl, token }),
        pdfExport: createPdfExportClient({ baseUrl, token })
    };
}
