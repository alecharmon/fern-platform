import { createPdfExportClient, type PdfExportClient } from "./pdf-export/client.js";

export interface FdrORPCClient {
    pdfExport: PdfExportClient;
}

export interface CreateFdrORPCClientOptions {
    baseUrl: string;
    token: string;
}

/**
 * Creates a composed oRPC client with all FDR resources.
 * New resource clients should be added here as they are migrated.
 */
export function createFdrORPCClient(options: CreateFdrORPCClientOptions): FdrORPCClient {
    return {
        pdfExport: createPdfExportClient(options)
    };
}
