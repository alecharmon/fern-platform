import { createPruneKey } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import type { EndpointDefinition } from "@fern-api/fdr-sdk/api-definition";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { AsyncApiYamlFormatter, OpenApiYamlFormatter } from "@fern-docs/search-utils";

import { convertToLlmTxtMarkdown } from "./llm-txt-md";
import { runAsyncSpan, runSyncSpan } from "./tracing";

export type SdkLanguageFilter = "node" | "python" | "java" | "ruby" | "go" | "csharp" | "swift";

export interface MarkdownFilterOptions {
    sdkLanguage?: SdkLanguageFilter;
    excludeSpec?: boolean;
}

const SDK_LANGUAGE_MAPPINGS: Record<SdkLanguageFilter, string[]> = {
    node: ["typescript", "javascript", "node", "js", "ts"],
    python: ["python", "py"],
    java: ["java"],
    ruby: ["ruby"],
    go: ["go", "golang"],
    csharp: ["csharp"],
    swift: ["swift"]
};

export function isValidSdkLanguage(language: string): language is SdkLanguageFilter {
    return ["node", "python", "java", "ruby", "go", "csharp", "swift"].includes(language);
}

const LANGUAGE_PARAM_ALIASES: Record<string, SdkLanguageFilter> = Object.entries(SDK_LANGUAGE_MAPPINGS).reduce(
    (acc, [sdkLanguage, aliases]) => {
        for (const alias of aliases) {
            acc[alias.toLowerCase()] = sdkLanguage as SdkLanguageFilter;
        }
        return acc;
    },
    {} as Record<string, SdkLanguageFilter>
);

export function parseSdkLanguageFilter(langParam: string | null): SdkLanguageFilter | undefined {
    if (langParam == null) {
        return undefined;
    }
    return LANGUAGE_PARAM_ALIASES[langParam.toLowerCase()];
}

function shouldIncludeLanguage(language: string, sdkLanguageFilter?: SdkLanguageFilter): boolean {
    if (sdkLanguageFilter == null) {
        return true;
    }
    const allowedLanguages = SDK_LANGUAGE_MAPPINGS[sdkLanguageFilter];
    return allowedLanguages.includes(language.toLowerCase());
}

function generateEndpointSections(
    endpoint: EndpointDefinition,
    apiDefinition?: ApiDefinition.ApiDefinition,
    excludeSpec?: boolean
): string[] {
    if (excludeSpec) {
        return [];
    }

    const sections: string[] = [];

    try {
        const formatter = new OpenApiYamlFormatter();
        const openApiYaml = formatter.generateYamlFromEndpoint(endpoint, apiDefinition);

        sections.push(`## OpenAPI Specification\n\n\`\`\`yaml\n${openApiYaml}\n\`\`\``);
    } catch (error) {
        console.error(JSON.stringify(error));
    }

    return sections;
}

function generateWebhookSections(
    webhook: ApiDefinition.WebhookDefinition,
    apiDefinition?: ApiDefinition.ApiDefinition,
    excludeSpec?: boolean
): string[] {
    if (excludeSpec) {
        return [];
    }

    const sections: string[] = [];

    try {
        const formatter = new OpenApiYamlFormatter();
        const openApiYaml = formatter.generateYamlFromWebhook(webhook, apiDefinition);

        sections.push(`## OpenAPI 3.1 Webhook Specification\n\n\`\`\`yaml\n${openApiYaml}\n\`\`\``);
    } catch (error) {
        console.error(JSON.stringify(error));
    }

    return sections;
}

function generateWebSocketSections(
    websocket: ApiDefinition.WebSocketChannel,
    apiDefinition?: ApiDefinition.ApiDefinition,
    excludeSpec?: boolean
): string[] {
    if (excludeSpec) {
        return [];
    }

    const sections: string[] = [];

    try {
        const asyncFormatter = new AsyncApiYamlFormatter();
        const asyncApiYaml = asyncFormatter.generateYamlFromWebSocket(websocket, apiDefinition);

        sections.push(`## AsyncAPI Specification\n\n\`\`\`yaml\n${asyncApiYaml}\n\`\`\``);
    } catch (error) {
        console.error(JSON.stringify(error));
    }

    return sections;
}

export async function getMarkdownForPath(
    node: FernNavigation.NavigationNodePage,
    loader: DocsLoader,
    domain?: string,
    userRoles: string[] = [],
    filterOptions?: MarkdownFilterOptions
): Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined> {
    return runAsyncSpan(
        "docs.getMarkdownForPath",
        async () => {
            if (FernNavigation.isApiLeaf(node)) {
                const apiDefinition = await runAsyncSpan(
                    "docs.loader.getPrunedApi",
                    () => loader.getPrunedApi(node.apiDefinitionId, createPruneKey(node)),
                    {
                        "fern.docs.apiDefinitionId": node.apiDefinitionId ?? "unknown"
                    }
                );
                if (apiDefinition == null) {
                    return undefined;
                }
                if (node.type === "endpoint") {
                    const endpoint = apiDefinition.endpoints[node.endpointId];
                    if (endpoint == null) {
                        return undefined;
                    }
                    return {
                        content: endpointDefinitionToMarkdown(endpoint, node, domain, apiDefinition, filterOptions),
                        contentType: "mdx"
                    };
                }
                if (node.type === "webhook") {
                    const webhook = apiDefinition.webhooks[node.webhookId];
                    if (webhook == null) {
                        return undefined;
                    }
                    return {
                        content: webhookDefinitionToMarkdown(webhook, node, domain, apiDefinition, filterOptions),
                        contentType: "mdx"
                    };
                }
                if (node.type === "webSocket") {
                    const websocket = apiDefinition.websockets[node.webSocketId];
                    if (websocket == null) {
                        return undefined;
                    }
                    return {
                        content: websocketDefinitionToMarkdown(websocket, node, domain, apiDefinition, filterOptions),
                        contentType: "mdx"
                    };
                }
            }

            const pageId = FernNavigation.getPageId(node);
            if (pageId == null) {
                return undefined;
            }

            const page = await runAsyncSpan("docs.loader.getPage", () => loader.getPage(pageId), {
                "fern.docs.pageId": pageId
            });
            if (!page) {
                return undefined;
            }

            const contentType = pageId.endsWith(".mdx") ? "mdx" : "markdown";
            const content = runSyncSpan(
                "docs.convertToMarkdown",
                () =>
                    convertToLlmTxtMarkdown(page.markdown, node.title, contentType === "mdx" ? "mdx" : "md", userRoles),
                {
                    "fern.docs.pageId": pageId,
                    "fern.docs.contentType": contentType
                }
            );

            return {
                content,
                contentType
            };
        },
        {
            "fern.docs.domain": domain ?? "unknown",
            "fern.docs.node.type": node.type
        }
    );
}

export function getPageNodeForPath(
    root: FernNavigation.RootNode | undefined,
    path: string
): FernNavigation.NavigationNodePage | undefined {
    if (root == null) {
        return undefined;
    }
    const found = FernNavigation.utils.findNode(root, slugjoin(path));
    if (found.type !== "found" || !FernNavigation.isPage(found.node)) {
        return undefined;
    }
    return found.node;
}

export function endpointDefinitionToMarkdown(
    endpoint: EndpointDefinition,
    node: FernNavigation.NavigationNodePage,
    domain?: string,
    apiDefinition?: ApiDefinition.ApiDefinition,
    filterOptions?: MarkdownFilterOptions
): string {
    return runSyncSpan(
        "docs.endpointDefinitionToMarkdown",
        () => {
            const pageHref = slugToHref(node.canonicalSlug ?? node.slug);
            const fullUrl = domain ? `https://${domain}${pageHref}` : undefined;

            const endpointSections = generateEndpointSections(endpoint, apiDefinition, filterOptions?.excludeSpec);

            const examplesContent = endpoint.examples
                ?.flatMap((example) => {
                    // We have examples for all status codes (although the code will be repeated)
                    // So only process examples with response status code 201
                    // Only skip if the status code is not a 2xx "OK" HTTP status code
                    if (
                        typeof example.responseStatusCode !== "number" ||
                        example.responseStatusCode < 200 ||
                        example.responseStatusCode >= 300
                    ) {
                        return [];
                    }

                    return Object.entries(example.snippets ?? {}).flatMap(([language, snippets]) => {
                        // Filter out curl snippets, since AI should know how to use curl. SDK examples are specific to that generated SDK, so that would be helpful to use.
                        if (language === "curl") {
                            return [];
                        }

                        // Filter by SDK language if specified
                        if (!shouldIncludeLanguage(language, filterOptions?.sdkLanguage)) {
                            return [];
                        }

                        return snippets.map((snippet) => {
                            return {
                                language,
                                snippet,
                                name: snippet.name ?? example.name
                            } as const;
                        });
                    });
                })
                .map(
                    ({ language, snippet, name }) =>
                        `\`\`\`${language}${name != null ? ` ${name}` : ""}\n${snippet.code}\n\`\`\``
                )
                .join("\n\n");

            const hasExamples = examplesContent && examplesContent.trim().length > 0;

            return [
                `# ${node.title}`,
                [
                    `${endpoint.method} ${endpoint.environments?.find((env) => env.id === endpoint.defaultEnvironment)?.baseUrl ?? endpoint.environments?.[0]?.baseUrl ?? ""}${ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path)}`,
                    endpoint.requests?.[0] != null ? `Content-Type: ${endpoint.requests[0].contentType}` : undefined
                ]
                    .filter(isNonNullish)
                    .join("\n"),
                typeof endpoint.description === "string" ? endpoint.description : undefined,
                fullUrl ? `Reference: ${fullUrl}` : undefined,
                ...endpointSections,
                hasExamples ? "## SDK Code Examples" : undefined,
                hasExamples ? examplesContent : undefined
            ]
                .filter(isNonNullish)
                .join("\n\n");
        },
        {
            "fern.docs.node.title": node.title,
            "fern.docs.node.slug": node.slug,
            "fern.docs.domain": domain ?? "unknown"
        }
    );
}

export function webhookDefinitionToMarkdown(
    webhook: ApiDefinition.WebhookDefinition,
    node: FernNavigation.NavigationNodePage,
    domain?: string,
    apiDefinition?: ApiDefinition.ApiDefinition,
    filterOptions?: MarkdownFilterOptions
): string {
    return runSyncSpan(
        "docs.webhookDefinitionToMarkdown",
        () => {
            const pageHref = slugToHref(node.canonicalSlug ?? node.slug);
            const fullUrl = domain ? `https://${domain}${pageHref}` : undefined;

            const webhookSections = generateWebhookSections(webhook, apiDefinition, filterOptions?.excludeSpec);

            return [
                `# ${node.title}`,
                `${webhook.method} ${webhook.path.join("")}`,
                typeof webhook.description === "string" ? webhook.description : undefined,
                fullUrl ? `Reference: ${fullUrl}` : undefined,
                ...webhookSections
            ]
                .filter(isNonNullish)
                .join("\n\n");
        },
        {
            "fern.docs.node.title": node.title,
            "fern.docs.node.slug": node.slug,
            "fern.docs.domain": domain ?? "unknown"
        }
    );
}

export function websocketDefinitionToMarkdown(
    websocket: ApiDefinition.WebSocketChannel,
    node: FernNavigation.NavigationNodePage,
    domain?: string,
    apiDefinition?: ApiDefinition.ApiDefinition,
    filterOptions?: MarkdownFilterOptions
): string {
    return runSyncSpan(
        "docs.websocketDefinitionToMarkdown",
        () => {
            const pageHref = slugToHref(node.canonicalSlug ?? node.slug);
            const fullUrl = domain ? `https://${domain}${pageHref}` : undefined;

            const websocketSections = generateWebSocketSections(websocket, apiDefinition, filterOptions?.excludeSpec);

            return [
                `# ${node.title}`,
                `GET ${ApiDefinition.toCurlyBraceEndpointPathLiteral(websocket.path)}`,
                typeof websocket.description === "string" ? websocket.description : undefined,
                fullUrl ? `Reference: ${fullUrl}` : undefined,
                ...websocketSections
            ]
                .filter(isNonNullish)
                .join("\n\n");
        },
        {
            "fern.docs.node.title": node.title,
            "fern.docs.node.slug": node.slug,
            "fern.docs.domain": domain ?? "unknown"
        }
    );
}
