import type { OpenAPIServer, OpenAPIServerVariable } from "./openapi-types.js";
import type { PostmanItemOrGroup, PostmanUrl, PostmanVariable } from "./postman-types.js";
import { isItemGroup } from "./postman-types.js";
import { extractRawUrl, resolveVariables } from "./utils.js";

/**
 * Extracts unique server URLs from all requests in the collection.
 * Resolves variables and deduplicates base URLs.
 */
export function extractServers(items: PostmanItemOrGroup[], collectionVariables?: PostmanVariable[]): OpenAPIServer[] {
    const baseUrls = new Set<string>();
    collectBaseUrls(items, baseUrls, collectionVariables);

    const servers: OpenAPIServer[] = [];
    for (const url of baseUrls) {
        const { serverUrl, variables } = extractServerVariables(url);
        const server: OpenAPIServer = { url: serverUrl };
        if (Object.keys(variables).length > 0) {
            server.variables = variables;
        }
        servers.push(server);
    }

    return servers;
}

function collectBaseUrls(
    items: PostmanItemOrGroup[],
    baseUrls: Set<string>,
    collectionVariables?: PostmanVariable[]
): void {
    for (const item of items) {
        if (isItemGroup(item)) {
            collectBaseUrls(item.item, baseUrls, collectionVariables);
        } else {
            const request = item.request;
            if (typeof request === "string") {
                continue;
            }
            const rawUrl = extractRawUrl(request.url);
            if (!rawUrl) {
                continue;
            }

            const resolved = resolveVariables(rawUrl, collectionVariables);
            const baseUrl = extractBaseUrl(resolved, request.url);
            if (baseUrl) {
                baseUrls.add(baseUrl);
            }
        }
    }
}

/**
 * Extracts the base URL (protocol + host + port) from a resolved URL.
 * Uses the resolved URL (with variables substituted) rather than the raw structured URL.
 */
function extractBaseUrl(resolvedUrl: string, _postmanUrl?: PostmanUrl | string): string {
    // Parse the resolved URL (which has collection variables substituted)
    try {
        const url = new URL(resolvedUrl.startsWith("http") ? resolvedUrl : `https://${resolvedUrl}`);
        return `${url.protocol}//${url.host}`;
    } catch {
        const match = resolvedUrl.match(/^(https?:\/\/[^/]+)/);
        return match?.[1] ?? "";
    }
}

/**
 * Extracts OpenAPI server variables from `{variable}` patterns in the URL.
 */
function extractServerVariables(url: string): {
    serverUrl: string;
    variables: Record<string, OpenAPIServerVariable>;
} {
    const variables: Record<string, OpenAPIServerVariable> = {};
    const variablePattern = /\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = variablePattern.exec(url)) !== null) {
        const varName = match[1];
        if (varName != null) {
            variables[varName] = {
                default: ""
            };
        }
    }

    return { serverUrl: url, variables };
}
