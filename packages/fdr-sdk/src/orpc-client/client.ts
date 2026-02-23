import { createDocsCacheClient, type DocsCacheClient } from "./docs-cache/client.js";
import { createPdfExportClient, type PdfExportClient } from "./pdf-export/client.js";
import { createTokensClient, type TokensClient } from "./tokens/client.js";

export interface FdrORPCClient {
    docsCache: DocsCacheClient;
    pdfExport: PdfExportClient;
    tokens: TokensClient;
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
        docsCache: createDocsCacheClient(options),
        pdfExport: createPdfExportClient(options)
        tokens: createTokensClient(options)
    };
}
