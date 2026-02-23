import { createDashboardClient, type DashboardClient } from "./dashboard/client.js";
import { createDocsCacheClient, type DocsCacheClient } from "./docs-cache/client.js";
import { createPdfExportClient, type PdfExportClient } from "./pdf-export/client.js";
import { createTemplatesClient, type TemplatesClient } from "./templates/client.js";
import { createTokensClient, type TokensClient } from "./tokens/client.js";

export interface FdrORPCClient {
    dashboard: DashboardClient;
    docsCache: DocsCacheClient;
    pdfExport: PdfExportClient;
    templates: TemplatesClient;
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
        dashboard: createDashboardClient(options),
        docsCache: createDocsCacheClient(options),
        pdfExport: createPdfExportClient(options),
        templates: createTemplatesClient(options),
        tokens: createTokensClient(options)
    };
}
