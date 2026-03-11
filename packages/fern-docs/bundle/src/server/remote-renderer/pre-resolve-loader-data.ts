import type { CachedDocsLoader } from "@fern-api/docs-loader";
import type { HttpMethod } from "@fern-api/docs-utils";
import type { ApiDefinition } from "@fern-api/fdr-sdk";
import type { AuthScheme, EndpointId, ObjectProperty, TypeDefinition, TypeId } from "@fern-api/fdr-sdk/api-definition";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import { gunzipSync } from "zlib";
import { parseApiLinkHref } from "@/mdx/plugins/rehype-api-links";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

// ─── Types ──────────────────────────────────────────────

export interface EndpointLocator {
    method: HttpMethod;
    path: string;
    example?: string;
    apiName?: string;
}

export interface PreResolvedLoaderData {
    resolvedEndpoints: Map<
        string,
        {
            apiDefinitionId: ApiDefinition.ApiDefinitionId;
            endpoint: ApiDefinition.EndpointDefinition;
            slugs: Slug[];
        } | null // null = scanned but not found in API definition
    >;
    resolvedEndpointDetails: Map<
        string,
        {
            endpoint: ApiDefinition.EndpointDefinition;
            globalHeaders: ObjectProperty[];
            authSchemes: AuthScheme[];
            types: Record<TypeId, TypeDefinition>;
        }
    >;
    resolvedWebhooks: Map<
        string,
        {
            apiDefinitionId: ApiDefinition.ApiDefinitionId;
            webhook: ApiDefinition.WebhookDefinition;
            slug: Slug | undefined;
        }
    >;
    resolvedTypes: Map<string, Record<TypeId, TypeDefinition> | null>; // null = scanned but failed to resolve from FDR
}

// ─── Key Generators ─────────────────────────────────────

export function endpointLocatorKey(locator: EndpointLocator): string {
    return `${locator.method}::${locator.path}::${locator.example ?? ""}::${locator.apiName ?? ""}`;
}

export function endpointDetailsKey(apiDefinitionId: string, endpointId: EndpointId): string {
    return `${apiDefinitionId}::${endpointId}`;
}

// ─── Scanning ───────────────────────────────────────────

/**
 * Scans MDX content for endpoint/webhook/type references that require loader calls.
 * Returns deduplicated sets of endpoint locators, webhook IDs, and API names.
 */
export function scanMdxForLoaderRefs(contents: string[]): {
    endpointLocators: EndpointLocator[];
    webhookIds: string[];
    apiNames: string[];
} {
    const endpointLocatorSet = new Map<string, EndpointLocator>();
    const webhookIdSet = new Set<string>();
    const apiNameSet = new Set<string>();

    // Regex patterns
    // Match entire JSX tags containing endpoint/webhook props to avoid cross-contamination
    // Support both HTML attribute syntax (prop="value") and JSX expression syntax (prop={"value"})
    const endpointJsxTagPattern = /<\w+\s+[^>]*?endpoint\s*=\s*\{?\s*["'][^"']+["']\s*\}?[^>]*?\/?>/gi;
    const webhookJsxTagPattern = /<\w+\s+[^>]*?webhook\s*=\s*\{?\s*["'][^"']+["']\s*\}?[^>]*?\/?>/gi;
    const apiLinkPattern = /\]\(api:[^)]+\)/gi;
    const apiNamePatternGlobal = /api\s*=\s*\{?\s*["']([^"']+)["']\s*\}?/gi; // Global scan for all api names

    // Detect Schema-like components that may call getTypes() without an api prop
    const schemaPattern =
        /<(?:Schema|SchemaSnippet|ModelSnippet|MergeSupportedFieldsByIntegrationWidget|MergeAccessedThirdPartyEndpointsWidget)\b/gi;

    // Pattern to extract data props from Merge widgets (base64 gzip-encoded JSON containing apiName)
    const mergeWidgetDataPattern =
        /<(?:MergeSupportedFieldsByIntegrationWidget|MergeAccessedThirdPartyEndpointsWidget)\s+[^>]*?data\s*=\s*\{?\s*["']([^"']+)["']\s*\}?[^>]*?\/?>/gi;

    // Non-global patterns for extracting props from within a single tag
    // Support both HTML attribute syntax (prop="value") and JSX expression syntax (prop={"value"})
    const endpointPropPattern = /endpoint\s*=\s*\{?\s*["']([^"']+)["']\s*\}?/i;
    const examplePropPattern = /example\s*=\s*\{?\s*["']([^"']+)["']\s*\}?/i;
    const apiPropPattern = /api\s*=\s*\{?\s*["']([^"']+)["']\s*\}?/i;
    const webhookPropPattern = /webhook\s*=\s*\{?\s*["']([^"']+)["']\s*\}?/i;

    for (const content of contents) {
        // Scan for JSX tags with endpoint props
        // Match entire tag to avoid cross-contamination from neighboring components
        for (const tagMatch of content.matchAll(endpointJsxTagPattern)) {
            const tag = tagMatch[0];

            // Extract props from within this single tag
            const endpointMatch = tag.match(endpointPropPattern);
            const exampleMatch = tag.match(examplePropPattern);
            const apiMatch = tag.match(apiPropPattern);

            const endpointStr = endpointMatch?.[1];
            if (!endpointStr) {
                continue;
            }

            // Parse method and path
            const parts = endpointStr.trim().split(/\s+/);
            if (parts.length < 2) {
                continue;
            }

            const method = parts[0]?.toUpperCase() as HttpMethod;
            const path = parts.slice(1).join(" ");
            const example = exampleMatch?.[1];
            const apiName = apiMatch?.[1];

            const locator: EndpointLocator = { method, path, example, apiName };
            const key = endpointLocatorKey(locator);
            endpointLocatorSet.set(key, locator);
        }

        // Scan for JSX tags with webhook props
        for (const tagMatch of content.matchAll(webhookJsxTagPattern)) {
            const tag = tagMatch[0];
            const webhookMatch = tag.match(webhookPropPattern);
            const webhookId = webhookMatch?.[1];
            if (webhookId) {
                webhookIdSet.add(webhookId);
            }
        }

        // Scan for api: links (e.g., ](api:POST/v2/payments))
        for (const linkMatch of content.matchAll(apiLinkPattern)) {
            const linkText = linkMatch[0];
            // Extract the href part: api:...
            const hrefMatch = linkText.match(/api:[^)]+/);
            if (hrefMatch) {
                const href = hrefMatch[0];
                const parsed = parseApiLinkHref(href);
                if (parsed) {
                    const locator: EndpointLocator = {
                        method: parsed.method,
                        path: parsed.path,
                        apiName: parsed.apiName
                    };
                    const key = endpointLocatorKey(locator);
                    endpointLocatorSet.set(key, locator);
                }
            }
        }

        // Scan for all api="..." props to collect API names for type resolution
        for (const apiNameMatch of content.matchAll(apiNamePatternGlobal)) {
            const apiName = apiNameMatch[1];
            if (apiName) {
                apiNameSet.add(apiName);
            }
        }
    }

    // Only pre-resolve default types (no apiName) if Schema-like components are detected
    // These components call getTypes(undefined) when no api="..." prop is provided.
    // NOTE: This is component-name matching, which is brittle. If a new component
    // is added that calls getTypes() without an api prop, it needs to be added to schemaPattern.
    // The more robust alternative is to always require api="..." on Schema components
    // in pages that go through the remote renderer.
    let needsDefaultTypes = false;
    for (const content of contents) {
        if (schemaPattern.test(content)) {
            needsDefaultTypes = true;
            break;
        }
        schemaPattern.lastIndex = 0;
    }
    if (needsDefaultTypes && !apiNameSet.has("")) {
        apiNameSet.add("");
    }

    // Scan for Merge widget data props that contain apiName inside gzip-encoded JSON.
    // These widgets embed their apiName in a base64 gzip-encoded "data" prop,
    // which the standard api="..." scanning above doesn't detect.
    for (const content of contents) {
        for (const match of content.matchAll(mergeWidgetDataPattern)) {
            const base64Data = match[1];
            if (base64Data) {
                try {
                    const decoded = gunzipSync(Buffer.from(base64Data, "base64"));
                    const parsed: unknown = JSON.parse(decoded.toString("utf-8"));

                    let apiName: string | undefined;
                    if (Array.isArray(parsed)) {
                        // MergeAccessedThirdPartyEndpointsWidget: data is array of endpoints
                        apiName = (parsed[0] as { apiName?: string } | undefined)?.apiName;
                    } else if (parsed != null && typeof parsed === "object") {
                        // MergeSupportedFieldsByIntegrationWidget: data is object with apiName field
                        apiName = (parsed as { apiName?: string }).apiName;
                    }

                    if (apiName) {
                        apiNameSet.add(apiName);
                    }
                } catch {
                    // Ignore decode errors during scanning - data may be malformed
                }
            }
        }
    }

    return {
        endpointLocators: Array.from(endpointLocatorSet.values()),
        webhookIds: Array.from(webhookIdSet),
        apiNames: Array.from(apiNameSet)
    };
}

// ─── Pre-resolution ─────────────────────────────────────

/**
 * Pre-resolves all loader data needed for the batch.
 * Calls the real loader on the bundle server and returns serializable data.
 */
export async function preResolveLoaderData(
    loader: CachedDocsLoader | undefined,
    contents: string[]
): Promise<PreResolvedLoaderData> {
    const emptyResult: PreResolvedLoaderData = {
        resolvedEndpoints: new Map(),
        resolvedEndpointDetails: new Map(),
        resolvedWebhooks: new Map(),
        resolvedTypes: new Map()
    };

    if (!loader) {
        return emptyResult;
    }

    const { endpointLocators, webhookIds, apiNames } = scanMdxForLoaderRefs(contents);

    if (endpointLocators.length === 0 && webhookIds.length === 0 && apiNames.length === 0) {
        // No loader refs found - fast path for VAPI-style pages
        if (DEBUG) {
            console.log(
                `[RemoteBatchSerializer] No endpoint/webhook/type references found - skipping loader pre-resolution`
            );
        }
        return emptyResult;
    }

    if (DEBUG) {
        console.log(
            `[RemoteBatchSerializer] Pre-resolving loader data: ${endpointLocators.length} endpoints, ${webhookIds.length} webhooks, ${apiNames.length} API names for types`
        );
    }

    const resolvedEndpoints = new Map<
        string,
        {
            apiDefinitionId: ApiDefinition.ApiDefinitionId;
            endpoint: ApiDefinition.EndpointDefinition;
            slugs: Slug[];
        } | null
    >();
    const resolvedEndpointDetails = new Map<
        string,
        {
            endpoint: ApiDefinition.EndpointDefinition;
            globalHeaders: ObjectProperty[];
            authSchemes: AuthScheme[];
            types: Record<TypeId, TypeDefinition>;
        }
    >();
    const resolvedWebhooks = new Map<
        string,
        {
            apiDefinitionId: ApiDefinition.ApiDefinitionId;
            webhook: ApiDefinition.WebhookDefinition;
            slug: Slug | undefined;
        }
    >();

    // Resolve endpoints
    await Promise.all(
        endpointLocators.map(async (locator) => {
            try {
                const result = await loader.getEndpointByLocator(
                    locator.method,
                    locator.path,
                    locator.example,
                    locator.apiName
                );
                const key = endpointLocatorKey(locator);
                resolvedEndpoints.set(key, result);

                // Also resolve endpoint details
                try {
                    const details = await loader.getEndpointById(result.apiDefinitionId, result.endpoint.id);
                    const detailsKey = endpointDetailsKey(result.apiDefinitionId, result.endpoint.id);
                    resolvedEndpointDetails.set(detailsKey, details);
                } catch (detailsError) {
                    console.warn(
                        `[RemoteBatchSerializer] Failed to resolve endpoint details for ${locator.method} ${locator.path}:`,
                        detailsError
                    );
                }
            } catch (error) {
                // Store null as a negative result so the remote renderer can distinguish
                // "scanned but doesn't exist in API" from "not scanned at all"
                const key = endpointLocatorKey(locator);
                resolvedEndpoints.set(key, null);
                console.warn(
                    `[RemoteBatchSerializer] Failed to resolve endpoint ${locator.method} ${locator.path}:`,
                    error
                );
            }
        })
    );

    // Resolve webhooks
    await Promise.all(
        webhookIds.map(async (webhookId) => {
            try {
                const result = await loader.getWebhookByLocator(webhookId);
                if (result) {
                    resolvedWebhooks.set(webhookId, result);
                }
            } catch (error) {
                console.warn(`[RemoteBatchSerializer] Failed to resolve webhook ${webhookId}:`, error);
            }
        })
    );

    // Resolve types for each API name
    const resolvedTypes = new Map<string, Record<TypeId, TypeDefinition> | null>();
    await Promise.all(
        apiNames.map(async (apiName) => {
            try {
                // Empty string means call getTypes() with no argument (all types)
                const types = await loader.getTypes(apiName === "" ? undefined : apiName);
                resolvedTypes.set(apiName, types);
            } catch (error) {
                // Store null as a negative result so the remote renderer can distinguish
                // "scanned but couldn't resolve" from "not scanned at all"
                resolvedTypes.set(apiName, null);
                console.warn(
                    `[RemoteBatchSerializer] Failed to resolve types for API "${apiName || "(default)"}":`,
                    error
                );
            }
        })
    );

    if (DEBUG) {
        console.log(
            `[RemoteBatchSerializer] Pre-resolved: ${resolvedEndpoints.size} endpoints, ${resolvedEndpointDetails.size} endpoint details, ${resolvedWebhooks.size} webhooks, ${resolvedTypes.size} type sets`
        );
    }

    return {
        resolvedEndpoints,
        resolvedEndpointDetails,
        resolvedWebhooks,
        resolvedTypes
    };
}
