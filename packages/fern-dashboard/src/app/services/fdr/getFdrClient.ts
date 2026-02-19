/* eslint-disable turbo/no-undeclared-env-vars */
import { FdrClient } from "@fern-api/fdr-sdk/client";
import { createPdfExportClient, type PdfExportClient } from "@fern-api/fdr-sdk/orpc-client";

export function getFdrBaseUrl(): string {
    if (process.env.FDR_SERVER_URL == null) {
        throw new Error("FDR_SERVER_URL is not defined in the current environment");
    }
    return process.env.FDR_SERVER_URL;
}

export function getFdrClient({ token }: { token: string }): FdrClient {
    return new FdrClient({
        environment: getFdrBaseUrl(),
        token
    });
}

export function getOrpcFdrClient({ token }: { token: string }): { pdfExport: PdfExportClient } {
    return {
        pdfExport: createPdfExportClient({
            baseUrl: getFdrBaseUrl(),
            token
        })
    };
}
