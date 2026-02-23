import { createDashboardClient, type DashboardClient } from "./dashboard/client.js";
import { createDocsCacheClient, type DocsCacheClient } from "./docs-cache/client.js";
import { createGeneratorCliClient, type GeneratorCliClient } from "./generators/cli/client.js";
import { createGeneratorsRootClient, type GeneratorsRootClient } from "./generators/client.js";
import { createGeneratorVersionsClient, type GeneratorVersionsClient } from "./generators/versions/client.js";
import { createPdfExportClient, type PdfExportClient } from "./pdf-export/client.js";
import { createSdksClient, type SdksClient } from "./sdks/client.js";
import { createTemplatesClient, type TemplatesClient } from "./templates/client.js";
import { createTokensClient, type TokensClient } from "./tokens/client.js";

export interface GeneratorsClient {
    root: GeneratorsRootClient;
    cli: GeneratorCliClient;
    versions: GeneratorVersionsClient;
}

export interface FdrORPCClient {
    dashboard: DashboardClient;
    docsCache: DocsCacheClient;
    generators: GeneratorsClient;
    pdfExport: PdfExportClient;
    sdks: SdksClient;
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
        generators: {
            root: createGeneratorsRootClient(options),
            cli: createGeneratorCliClient(options),
            versions: createGeneratorVersionsClient(options)
        },
        pdfExport: createPdfExportClient(options),
        sdks: createSdksClient(options),
        templates: createTemplatesClient(options),
        tokens: createTokensClient(options)
    };
}
