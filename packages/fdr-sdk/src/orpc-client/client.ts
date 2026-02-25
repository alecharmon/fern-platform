import { type ApiClient, createApiClient } from "./api/client.js";
import { createDashboardClient, type DashboardClient } from "./dashboard/client.js";
import { createDocsClient, type DocsClient } from "./docs/client.js";
import { createDocsCacheClient, type DocsCacheClient } from "./docs-cache/client.js";
import { createDocsDeploymentClient, type DocsDeploymentClient } from "./docs-deployment/client.js";
import { createGeneratorCliClient, type GeneratorCliClient } from "./generators/cli/client.js";
import { createGeneratorsRootClient, type GeneratorsRootClient } from "./generators/client.js";
import { createGeneratorVersionsClient, type GeneratorVersionsClient } from "./generators/versions/client.js";
import { createGitClient, type GitClient } from "./git/client.js";
import { createPdfExportClient, type PdfExportClient } from "./pdf-export/client.js";
import { createSdksClient, type SdksClient } from "./sdks/client.js";
import {
    createSnippetsClient,
    createSnippetsFactoryClient,
    type SnippetsClient,
    type SnippetsFactoryClient
} from "./snippets/client.js";
import { createTemplatesClient, type TemplatesClient } from "./templates/client.js";
import { createTokensClient, type TokensClient } from "./tokens/client.js";

export interface GeneratorsClient {
    root: GeneratorsRootClient;
    cli: GeneratorCliClient;
    versions: GeneratorVersionsClient;
}

export interface FdrORPCClient {
    api: ApiClient;
    dashboard: DashboardClient;
    docs: DocsClient;
    docsCache: DocsCacheClient;
    docsDeployment: DocsDeploymentClient;
    generators: GeneratorsClient;
    git: GitClient;
    pdfExport: PdfExportClient;
    sdks: SdksClient;
    snippets: SnippetsClient;
    snippetsFactory: SnippetsFactoryClient;
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
    // Normalize baseUrl to remove trailing slashes to prevent double-slash in route paths
    const normalizedOptions = {
        ...options,
        baseUrl: options.baseUrl.replace(/\/+$/, "")
    };
    return {
        api: createApiClient(normalizedOptions),
        dashboard: createDashboardClient(normalizedOptions),
        docs: createDocsClient(normalizedOptions),
        docsCache: createDocsCacheClient(normalizedOptions),
        docsDeployment: createDocsDeploymentClient(normalizedOptions),
        generators: {
            root: createGeneratorsRootClient(normalizedOptions),
            cli: createGeneratorCliClient(normalizedOptions),
            versions: createGeneratorVersionsClient(normalizedOptions)
        },
        git: createGitClient(normalizedOptions),
        pdfExport: createPdfExportClient(normalizedOptions),
        sdks: createSdksClient(normalizedOptions),
        snippets: createSnippetsClient(normalizedOptions),
        snippetsFactory: createSnippetsFactoryClient(normalizedOptions),
        templates: createTemplatesClient(normalizedOptions),
        tokens: createTokensClient(normalizedOptions)
    };
}
