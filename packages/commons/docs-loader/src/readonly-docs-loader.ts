import type { AuthEdgeConfig } from "@fern-api/docs-auth";
// import { track } from "@fern-api/docs-server";
import {
    type AuthState,
    loadWithUrl as cachedLoadWithUrl,
    cleanBasePath,
    createGetAuthState,
    type DynamicIRsByLanguage,
    type FernFonts,
    findEndpoint,
    generateFernColorPalette,
    generateFonts,
    getDocsUrlMetadata,
    isDocsDev,
    isLocal,
    isSelfHosted,
    provideRegistryService,
    pruneWithAuthState,
    loadDynamicIRWithUrl as uncachedLoadDynamicIRWithUrl,
    uncachedLoadWithUrl
} from "@fern-api/docs-server";
import { type DocsLoader, type DocsMetadata, DocsMetadataSchema } from "@fern-api/docs-server/docs-loader";
import type { HttpMethod } from "@fern-api/docs-utils";
import {
    DEFAULT_CONTENT_WIDTH,
    DEFAULT_GUTTER_WIDTH,
    DEFAULT_HEADER_HEIGHT,
    DEFAULT_LOCAL_EDGE_FLAGS,
    DEFAULT_LOGO_HEIGHT,
    DEFAULT_PAGE_WIDTH,
    DEFAULT_SELF_HOSTED_EDGE_FLAGS,
    DEFAULT_SIDEBAR_WIDTH,
    type EdgeFlags,
    FERN_DOCS_ORIGINS,
    type FernColorTheme,
    withoutStaging
} from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernAIClient } from "@fern-api/fai-sdk";
import { type ApiDefinition, type DocsV1Read, type DocsV2Read, FernNavigation } from "@fern-api/fdr-sdk";
import {
    ApiDefinitionV1ToLatest,
    type AuthScheme,
    backfillSnippets,
    type EnvironmentId,
    type ObjectProperty,
    type PruningNodeType,
    prune,
    type TypeDefinition
} from "@fern-api/fdr-sdk/api-definition";
import { ApiDefinitionId, EndpointId, type PageId, type Slug, type TypeId } from "@fern-api/fdr-sdk/navigation";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish, isPlainObject } from "@fern-api/ui-core-utils";
import { visualEditorStorage } from "@fern-api/visual-editor-server";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";
import { createHash } from "crypto";
import { mapValues } from "es-toolkit";
import { unstable_cache, unstable_cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";
import { type AsyncOrSync, UnreachableCaseError } from "ts-essentials";

import {
    CACHE_KEY_ASK_AI_ENABLED,
    CACHE_KEY_COLORS,
    CACHE_KEY_CONFIG,
    CACHE_KEY_FILES,
    CACHE_KEY_FONTS,
    CACHE_KEY_LOGO_URLS,
    CACHE_KEY_MDX_BUNDLER_FILES,
    CACHE_KEY_METADATA,
    CACHE_KEY_ROOT,
    createDynamicIrCacheKey,
    createPageCacheKey
} from "./cache-keys";
import { createKvCache, type KvCache } from "./kv-cache";

// Create the appropriate cache implementation based on whether we're in docs dev mode
const kvCache: KvCache = createKvCache(isDocsDev());

const loadWithUrl = async (domainKey: string): Promise<DocsV2Read.LoadDocsForUrlResponse> => {
    const { domain, branchName } = decodeDocsLoaderDomainKey(domainKey);
    if (branchName) {
        try {
            const associatedBranchFdr = await visualEditorStorage.getFdrSnapshot(domain, branchName);
            if (associatedBranchFdr) {
                return associatedBranchFdr;
            }
        } catch (error) {
            console.warn(`Failed to get FDR snapshot for ${domain}:${branchName}, fallback to uncached`, error);
        }
    }
    if (branchName) {
        const response = await uncachedLoadWithUrl(domain);
        // Do not await this, we want to return the loadWithUrl response immediately
        visualEditorStorage
            .storeFdrSnapshot(domain, branchName, response)
            .then(() => {
                console.log(`[loadWithUrl] FDR snapshot stored for ${domain}:${branchName}`);
            })
            .catch((error: unknown) => {
                console.error(`[loadWithUrl] Failed to store FDR snapshot for ${domain}:${branchName}`, error);
            });
        return response;
    } else {
        const response = await cachedLoadWithUrl(domain);
        return response;
    }
};
const loadDynamicIRWithUrl = uncachedLoadDynamicIRWithUrl;

/*
 * Domain key decoder/encoder functions
 */
export function encodeDocsLoaderDomain(domain: string, branchName?: string) {
    return branchName ? `${domain}::${branchName}` : domain;
}

function decodeDocsLoaderDomainKey(domainKey: string) {
    const [domain = domainKey, branchName] = domainKey.split("::");
    return { domain, branchName };
}

function deriveDomainFromDomainKey(domainKey: string) {
    const { domain } = decodeDocsLoaderDomainKey(domainKey);
    return domain;
}

// Add cache configuration interface
export interface CacheConfig {
    /** TTL in seconds for KV cache entries */
    kvTtl?: number;
    /** Whether to force revalidation of all caches */
    forceRevalidate?: boolean;
    /** Custom cache key suffix for isolation */
    cacheKeySuffix?: string;
}

const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
    kvTtl: 0, // no expiration by default
    forceRevalidate: false,
    cacheKeySuffix: ""
};

function assertDocsDomain(domainKey: string) {
    const domain = deriveDomainFromDomainKey(domainKey);
    if (FERN_DOCS_ORIGINS.includes(domain) || domain.endsWith(".vercel.app")) {
        console.error(`[assertDocsDomain:${domain}] Found unexpected domain`);
        notFound();
    }
}

function kvSet(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string) {
    kvCache.set(domainKey, key, value, ttl, cacheKeySuffix);
}

async function kvGet<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null> {
    return kvCache.get<T>(domainKey, key, cacheKeySuffix);
}

// In-memory cache for config to reduce Upstash calls
interface InMemoryCacheEntry<T> {
    value: T;
    timestamp: number;
}

const IN_MEMORY_CONFIG_CACHE = new Map<
    string,
    InMemoryCacheEntry<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">>
>();
const IN_MEMORY_CACHE_TTL_MS = 60_000; // 60 seconds

function getFromInMemoryCache<T>(key: string): InMemoryCacheEntry<T>["value"] | null {
    const entry = IN_MEMORY_CONFIG_CACHE.get(key) as InMemoryCacheEntry<T> | undefined;
    if (!entry) {
        return null;
    }
    // Check if entry is expired
    if (Date.now() - entry.timestamp > IN_MEMORY_CACHE_TTL_MS) {
        IN_MEMORY_CONFIG_CACHE.delete(key);
        return null;
    }
    return entry.value;
}

function setInMemoryCache<T>(key: string, value: T): void {
    IN_MEMORY_CONFIG_CACHE.set(key, {
        value,
        timestamp: Date.now()
    } as InMemoryCacheEntry<any>);
}

async function clearKvCache(domainKey: string) {
    // Clear in-memory config cache entries for this domain
    const keysToDelete: string[] = [];
    for (const key of IN_MEMORY_CONFIG_CACHE.keys()) {
        if (key.startsWith(`${domainKey}:`)) {
            keysToDelete.push(key);
        }
    }
    for (const key of keysToDelete) {
        IN_MEMORY_CONFIG_CACHE.delete(key);
    }
    if (keysToDelete.length > 0) {
        console.debug(`In-memory config cache cleared for domainKey: ${domainKey} (${keysToDelete.length} entries)`);
    }

    // Clear KV cache using the abstraction
    await kvCache.clear(domainKey);
}

const cachedGetEdgeFlags = cache(async (domainKey: string) => {
    if (isLocal()) {
        return DEFAULT_LOCAL_EDGE_FLAGS;
    } else if (isSelfHosted()) {
        return DEFAULT_SELF_HOSTED_EDGE_FLAGS;
    }
    return await getEdgeFlags(domainKey);
});

export const getMetadataFromResponse = async (
    domainKey: string,
    responsePromise: AsyncOrSync<DocsV2Read.LoadDocsForUrlResponse>
): Promise<DocsMetadata> => {
    assertDocsDomain(domainKey);
    const [response, docsUrlMetadata] = await Promise.all([
        responsePromise,
        getDocsUrlMetadata(deriveDomainFromDomainKey(domainKey))
    ]);

    return {
        domain: response.baseUrl.domain,
        basePath: cleanBasePath(response.baseUrl.basePath),
        url: docsUrlMetadata.url,
        org: docsUrlMetadata.org,
        isPreview: docsUrlMetadata.isPreview
    };
};

export const getMetadata = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string): Promise<DocsMetadata> => {
        "use cache";
        unstable_cacheTag(domainKey, "getMetadata");
        assertDocsDomain(domainKey);

        try {
            const cached = DocsMetadataSchema.safeParse(
                await kvGet<DocsMetadata>(domainKey, CACHE_KEY_METADATA, cacheConfig.cacheKeySuffix)
            );
            if (cached.success) {
                console.debug("[getMetadata] cache hit:", cached.data);
                return cached.data;
            }
        } catch (error) {
            console.warn(`Failed to get metadata for ${domainKey} from kv, fallback to uncached`, error);
        }

        const metadata = await getMetadataFromResponse(domainKey, loadWithUrl(domainKey));
        kvSet(domainKey, CACHE_KEY_METADATA, metadata, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        console.debug("[getMetadata] cache miss:", metadata);
        return metadata;
    });

const getFiles = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domain: string): Promise<Record<string, FileData>> => {
        "use cache";
        unstable_cacheTag(domain, "getFiles");

        try {
            const cached = await kvGet<Record<string, FileData>>(domain, CACHE_KEY_FILES, cacheConfig.cacheKeySuffix);
            if (cached) {
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get files for ${domain}, fallback to uncached`, error);
        }
        const response = await loadWithUrl(domain);
        const files = mapValues(response.definition.filesV2, (file) => {
            if (file.type === "url") {
                return {
                    src:
                        process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
                            ? file.url.replace(getFileCDN(), `${response.baseUrl.basePath ?? ""}/_files`)
                            : file.url
                };
            } else if (file.type === "image") {
                return {
                    src:
                        process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
                            ? file.url.replace(getFileCDN(), `${response.baseUrl.basePath ?? ""}/_files`)
                            : file.url,
                    width: file.width,
                    height: file.height,
                    blurDataURL: file.blurDataUrl,
                    alt: file.alt
                };
            }
            throw new UnreachableCaseError(file);
        });

        kvSet(domain, CACHE_KEY_FILES, files, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return files;
    });

// the api reference may be too large to cache, so we don't cache it in the KV store
const getApi = async (domainKey: string, id: string) => {
    "use cache";
    unstable_cacheTag(domainKey, "getApi", id);
    const response = await loadWithUrl(domainKey);
    const latest = response.definition.apisV2[ApiDefinitionId(id)];
    if (latest != null) {
        return latest;
    }
    let v1 = response.definition.apis[ApiDefinitionId(id)];
    if (v1 == null) {
        const response = await provideRegistryService().api.v1.read.getApi(ApiDefinitionId(id));
        if (response.ok) {
            v1 = response.body;
        } else {
            console.error("Could not get API with ID", ApiDefinitionId(id));
            notFound();
        }
    }
    return ApiDefinitionV1ToLatest.from(v1).migrate();
};

const createGetPrunedApiCached = (domainKey: string, cacheConfig: Required<CacheConfig>) =>
    unstable_cache(
        async (id: string, ...nodes: PruningNodeType[]): Promise<ApiDefinition.ApiDefinition> => {
            // if there is only one node, and it's an endpoint, try to load from cache
            try {
                if (nodes.length === 1 && nodes[0]) {
                    const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
                    const cached = await kvGet<ApiDefinition.ApiDefinition>(domainKey, key, cacheConfig.cacheKeySuffix);
                    if (cached != null) {
                        const metadata = await getMetadata(cacheConfig)(domainKey);
                        const dynamicIr = await getDynamicIr(cacheConfig)(metadata.org, metadata.domain, id);
                        const settings = await getSettings(cacheConfig)(domainKey);
                        const flags = {
                            httpSnippets: settings.httpSnippets !== false ? settings.httpSnippets : false,
                            alwaysEnableJavaScriptFetch: settings.useJavascriptAsTypescript
                        };
                        return await backfillSnippets(cached, dynamicIr, flags);
                    }
                }
            } catch (error) {
                console.warn(`Failed to get pruned api for ${domainKey}:${id}, fallback to uncached`, error);
            }

            const api = await getApi(domainKey, id);
            const pruned = prune(api, ...nodes);
            for (const endpointK of Object.keys(pruned.endpoints)) {
                if (pruned.endpoints[EndpointId(endpointK)]?.environments?.length === 0) {
                    console.debug(`${endpointK} has empty environments, adding default URL.`);
                    pruned.endpoints[EndpointId(endpointK)]?.environments?.push({
                        id: "Default" as EnvironmentId,
                        baseUrl: "https://host.com"
                    });
                }
            }
            // if there is only one node, and it's an endpoint, try to cache the result
            if (nodes.length === 1 && nodes[0]) {
                const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
                kvSet(domainKey, key, pruned, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
            }
            const metadata = await getMetadata(cacheConfig)(domainKey);
            const dynamicIr = await getDynamicIr(cacheConfig)(metadata.org, metadata.domain, id);
            const settings = await getSettings(cacheConfig)(domainKey);
            const flags = {
                httpSnippets: settings.httpSnippets !== false ? settings.httpSnippets : false,
                alwaysEnableJavaScriptFetch: settings.useJavascriptAsTypescript
            };
            return backfillSnippets(pruned, dynamicIr, flags);
        },
        [domainKey, cacheConfig.cacheKeySuffix],
        { tags: [domainKey, "api"] }
    );

export function createEndpointCacheKey(pruneType: PruningNodeType) {
    switch (pruneType.type) {
        case "endpoint":
            return `endpoint:${pruneType.endpointId}`;
        case "webSocket":
            return `websocket:${pruneType.webSocketId}`;
        case "webhook":
            return `webhook:${pruneType.webhookId}`;
        case "grpc":
            return `grpc:${pruneType.grpcId}`;
        default:
            throw new UnreachableCaseError(pruneType);
    }
}

const getEndpointById = async ({
    domainKey,
    apiDefinitionId,
    endpointId,
    cacheConfig
}: {
    domainKey: string;
    apiDefinitionId: string;
    endpointId: EndpointId;
    cacheConfig: Required<CacheConfig>;
}): Promise<{
    endpoint: ApiDefinition.EndpointDefinition;
    nodes: FernNavigation.EndpointNode[];
    globalHeaders: ObjectProperty[];
    authSchemes: AuthScheme[];
    types: Record<TypeId, TypeDefinition>;
}> => {
    "use cache";
    unstable_cacheTag(domainKey, "getEndpointById", apiDefinitionId, endpointId);

    const api = await createGetPrunedApiCached(domainKey, cacheConfig)(apiDefinitionId, {
        type: "endpoint",
        endpointId
    });

    const endpoint = api.endpoints[endpointId];
    if (endpoint == null) {
        console.error("Could not find endpoint with ID", endpointId);
        notFound();
    }

    const root = await unsafe_getFullRoot(domainKey);
    return {
        endpoint,
        nodes: FernNavigation.NodeCollector.collect(root)
            .getNodesInOrder()
            .filter(FernNavigation.hasMetadata)
            .filter(
                (node): node is FernNavigation.EndpointNode =>
                    node.type === "endpoint" && node.apiDefinitionId === api.id && node.endpointId === endpoint.id
            ),
        globalHeaders: api.globalHeaders ?? [],
        authSchemes: endpoint.auth?.map((id) => api.auths[id]).filter(isNonNullish) ?? [],
        types: api.types
    };
};

const getEndpointByLocator = async (
    domainKey: string,
    method: HttpMethod,
    path: string,
    example?: string
): Promise<{
    apiDefinitionId: ApiDefinition.ApiDefinitionId;
    endpoint: ApiDefinition.EndpointDefinition;
    slugs: Slug[];
}> => {
    const root = await unsafe_getFullRoot(domainKey);

    const apiIds = new Set<string>();
    FernNavigation.traverseBF(root, (node) => {
        if (FernNavigation.hasMetadata(node) && "apiDefinitionId" in node && node.apiDefinitionId) {
            apiIds.add(node.apiDefinitionId);
        }
        return CONTINUE;
    });

    for (const apiId of apiIds) {
        const api = await getApi(domainKey, apiId);
        const endpoint = findEndpoint({
            apiDefinition: api,
            method,
            path,
            example
        });
        if (endpoint != null) {
            const slugs = FernNavigation.NodeCollector.collect(root)
                .getNodesInOrder()
                .filter(FernNavigation.hasMetadata)
                .filter(
                    (node) =>
                        node.type === "endpoint" && node.apiDefinitionId === api.id && node.endpointId === endpoint.id
                )
                .map((node) => node.slug);
            return {
                apiDefinitionId: api.id,
                endpoint,
                slugs
            };
        }
    }
    console.error(`Could not find endpoint ${method} ${path}`);
    notFound();
};

export function convertResponseToRootNode(response: DocsV2Read.LoadDocsForUrlResponse, edgeFlags: EdgeFlags) {
    let root: FernNavigation.RootNode | undefined;
    if (response.definition.config.root) {
        root = FernNavigation.migrate.FernNavigationV1ToLatest.create().root(response.definition.config.root);
    } else if (response.definition.config.navigation) {
        root = FernNavigation.utils.toRootNode(response, edgeFlags.isBatchStreamToggleDisabled);
    }

    if (root) {
        FernNavigation.traverseBF(root, (node) => {
            if (node.type === "apiReference") {
                node.paginated = true;
                return CONTINUE;
            }
            return SKIP;
        });
    }

    return root;
}

const unsafe_getFullRoot = async (domainKey: string) => {
    try {
        const cached = await kvGet<FernNavigation.RootNode>(domainKey, CACHE_KEY_ROOT);
        if (cached != null) {
            return cached;
        }
    } catch (error) {
        console.warn(`Failed to get full root for ${domainKey}, fallback to uncached`, error);
    }
    const response = await loadWithUrl(domainKey);
    const root = convertResponseToRootNode(response, await cachedGetEdgeFlags(domainKey));
    if (root == null) {
        console.error("Could not find root node for domainKey", domainKey);
        notFound();
    }
    return root;
};

const unsafe_getRootCached = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        return await unstable_cache(
            async (domainKey: string) => {
                try {
                    const cached = await kvGet<FernNavigation.RootNode>(
                        domainKey,
                        CACHE_KEY_ROOT,
                        cacheConfig.cacheKeySuffix
                    );
                    if (cached != null) {
                        return cached;
                    }
                } catch (error) {
                    console.warn(`Failed to get full root for ${domainKey}, fallback to uncached`, error);
                }

                // Get fresh data
                const root = await unsafe_getFullRoot(domainKey);

                // Cache the result
                kvSet(domainKey, CACHE_KEY_ROOT, root, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);

                return root;
            },
            ["unsafe_getRoot", domainKey, cacheConfig.cacheKeySuffix],
            { tags: [domainKey, "unsafe_getRoot"] }
        )(domainKey);
    });

const getRoot = async (
    domainKey: string,
    authState: AuthState,
    authConfig: AuthEdgeConfig | undefined,
    cacheConfig: Required<CacheConfig>
) => {
    let root = await unsafe_getRootCached(cacheConfig)(domainKey);
    if (authConfig) {
        root = pruneWithAuthState(authState, authConfig, root);
    }
    FernNavigation.utils.mutableUpdatePointsTo(root);
    return root;
};

const getRootCached = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string, authState: AuthState, authConfig: AuthEdgeConfig | undefined) => {
        return await unstable_cache(
            (domainKey: string, authState: AuthState, authConfig: AuthEdgeConfig | undefined) =>
                getRoot(domainKey, authState, authConfig, cacheConfig),
            [domainKey, cacheConfig.cacheKeySuffix],
            { tags: [domainKey, "getRoot"] }
        )(domainKey, authState, authConfig);
    });

const getNavigationNode = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string, id: string, authState: AuthState, authConfig: AuthEdgeConfig | undefined) => {
        const root = await getRootCached(cacheConfig)(domainKey, authState, authConfig);
        const collector = FernNavigation.NodeCollector.collect(root);
        const node = collector.get(FernNavigation.NodeId(id));
        if (node == null) {
            console.error(`Could not find node ${id} for domainKey ${domainKey}`);
            notFound();
        }
        return node;
    });

const getSettings = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        unstable_cacheTag(domainKey, "getSettings");

        const config = await getConfig(cacheConfig)(domainKey);
        if (!config) {
            console.error("Could not find config for domainKey", domainKey);
            notFound();
        }

        const settings = config.settings;

        return {
            darkModeCode: settings?.darkModeCode ?? false,
            defaultSearchFilters: settings?.defaultSearchFilters ?? false,
            disableSearch: settings?.disableSearch ?? false,
            disableAnalytics: settings?.disableAnalytics ?? false,
            hide404Page: settings?.hide404Page ?? false,
            httpSnippets: settings?.httpSnippets ?? true,
            searchText: settings?.searchText ?? undefined,
            useJavascriptAsTypescript: settings?.useJavascriptAsTypescript ?? false,
            disableExplorerProxy: settings?.disableExplorerProxy ?? false,
            // Localization support removed - always return "en"
            language: "en" as const // settings?.language ?? "en"
        };
    });

const getLanguage = (_cacheConfig: Required<CacheConfig>) =>
    cache(async (_domainKey: string) => {
        // Localization support removed - always return "en"
        // "use cache";
        // unstable_cacheTag(domainKey, "getLanguage");

        // const config = await getConfig(cacheConfig)(domainKey);
        // if (!config) {
        //     console.error("Could not find config for domainKey", domainKey);
        //     notFound();
        // }

        // return config.settings?.language ?? "en";
        return "en";
    });

const getConfig = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        // Skip in-memory cache in local development to ensure fresh CSS/config on hot reload
        if (!isLocal()) {
            // Check in-memory cache first
            const cacheKey = cacheConfig.cacheKeySuffix
                ? `${domainKey}:config:${cacheConfig.cacheKeySuffix}`
                : `${domainKey}:config`;
            const inMemoryCached =
                getFromInMemoryCache<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">>(cacheKey);
            if (inMemoryCached != null) {
                console.debug(`[getConfig] in-memory cache hit for ${domainKey}`);
                return inMemoryCached;
            }
        }

        try {
            const cached = await kvGet<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">>(
                domainKey,
                CACHE_KEY_CONFIG,
                cacheConfig.cacheKeySuffix
            );
            if (cached != null) {
                // Store in in-memory cache for future requests (skip in local dev)
                if (!isLocal()) {
                    const cacheKey = cacheConfig.cacheKeySuffix
                        ? `${domainKey}:config:${cacheConfig.cacheKeySuffix}`
                        : `${domainKey}:config`;
                    setInMemoryCache(cacheKey, cached);
                }
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get config for ${domainKey}, fallback to uncached`, error);
        }

        const response = await loadWithUrl(domainKey);
        const { navigation, root, ...config } = response.definition.config;

        // Store in Upstash and in-memory cache (skip in-memory in local dev)
        kvSet(domainKey, CACHE_KEY_CONFIG, config, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        if (!isLocal()) {
            const cacheKey = cacheConfig.cacheKeySuffix
                ? `${domainKey}:config:${cacheConfig.cacheKeySuffix}`
                : `${domainKey}:config`;
            setInMemoryCache(cacheKey, config);
        }

        return config;
    });

const getPage = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string, pageId: string, returnRawMarkdown: boolean = false) => {
        try {
            const page = await kvGet<DocsV1Read.PageContent>(
                domainKey,
                createPageCacheKey({ pageId }),
                cacheConfig.cacheKeySuffix
            );
            if (page != null && isPlainObject(page) && "markdown" in page) {
                const config = await getConfig(cacheConfig)(domainKey);
                return {
                    filename: pageId,
                    markdown: page.markdown,
                    editThisPageUrl: page.editThisPageUrl,
                    css: config.css,
                    rawMarkdown: returnRawMarkdown ? page.rawMarkdown : undefined
                };
            }
        } catch (error) {
            console.warn(`Failed to get page for ${domainKey}:${pageId}, fallback to uncached`, error);
        }

        const response = await loadWithUrl(domainKey);
        const page = response.definition.pages[pageId as PageId];
        if (page == null) {
            console.error(`Could not find page with ID ${pageId}`);
            notFound();
        }

        kvSet(domainKey, createPageCacheKey({ pageId }), page, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return {
            filename: pageId,
            markdown: page.markdown,
            editThisPageUrl: page.editThisPageUrl,
            css: response.definition.config.css,
            rawMarkdown: returnRawMarkdown ? page.rawMarkdown : undefined
        };
    });

const getMdxBundlerFiles = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        unstable_cacheTag(domainKey, "getMdxBundlerFiles");

        try {
            const cached = await kvGet<Record<string, string>>(
                domainKey,
                CACHE_KEY_MDX_BUNDLER_FILES,
                cacheConfig.cacheKeySuffix
            );
            if (cached) {
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get mdx bundler files for ${domainKey}, fallback to uncached`, error);
        }

        const response = await loadWithUrl(domainKey);
        const files = response.definition.jsFiles ?? {};
        kvSet(domainKey, CACHE_KEY_MDX_BUNDLER_FILES, files, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return files;
    });

const getColors = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        unstable_cacheTag(domainKey, "getColors");

        try {
            const cached = await kvGet<{
                light: FernColorTheme | undefined;
                dark: FernColorTheme | undefined;
            }>(domainKey, CACHE_KEY_COLORS, cacheConfig.cacheKeySuffix);
            if (cached) {
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get colors for ${domainKey}, fallback to uncached`, error);
        }

        const [config, files] = await Promise.all([
            getConfig(cacheConfig)(domainKey),
            getFiles(cacheConfig)(domainKey)
        ]);

        if (!config) {
            return { light: undefined, dark: undefined };
        }

        if (!config.colorsV3) {
            return { light: undefined, dark: undefined };
        }

        const light =
            config.colorsV3.type === "light"
                ? config.colorsV3
                : config.colorsV3.type === "darkAndLight"
                  ? config.colorsV3.light
                  : undefined;

        const dark =
            config.colorsV3.type === "dark"
                ? config.colorsV3
                : config.colorsV3.type === "darkAndLight"
                  ? config.colorsV3.dark
                  : undefined;

        const colors = {
            light: light
                ? {
                      logo: light.logo ? files[light.logo] : undefined,
                      backgroundImage: light.backgroundImage ? files[light.backgroundImage] : undefined,
                      ...generateFernColorPalette({
                          appearance: "light",
                          background: toOklch(light.background),
                          accent: toOklch(light.accentPrimary),
                          border: toOklch(light.border),
                          sidebarBackground: toOklch(light.sidebarBackground),
                          headerBackground: toOklch(light.headerBackground),
                          cardBackground: toOklch(light.cardBackground)
                      }),
                      backgroundGradient: light.background.type === "gradient"
                  }
                : undefined,
            dark: dark
                ? {
                      logo: dark.logo ? files[dark.logo] : undefined,
                      backgroundImage: dark.backgroundImage ? files[dark.backgroundImage] : undefined,
                      ...generateFernColorPalette({
                          appearance: "dark",
                          background: toOklch(dark.background),
                          accent: toOklch(dark.accentPrimary),
                          border: toOklch(dark.border),
                          sidebarBackground: toOklch(dark.sidebarBackground),
                          headerBackground: toOklch(dark.headerBackground),
                          cardBackground: toOklch(dark.cardBackground)
                      }),
                      backgroundGradient: dark.background.type === "gradient"
                  }
                : undefined
        };

        kvSet(domainKey, CACHE_KEY_COLORS, colors, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return colors;
    });

const getLogoUrls = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        unstable_cacheTag(domainKey, "getLogoUrls");

        try {
            const cached = await kvGet<{ light?: FileData; dark?: FileData }>(
                domainKey,
                CACHE_KEY_LOGO_URLS,
                cacheConfig.cacheKeySuffix
            );
            if (cached != null) {
                console.debug("[getLogoUrls] cache hit");
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get logo URLs for ${domainKey}, fallback to uncached`, error);
        }

        // Load directly from FDR, bypassing other caches
        const response = await loadWithUrl(domainKey);
        const config = response.definition.config;
        const filesV2 = response.definition.filesV2;

        // Extract logo file IDs from colorsV3
        const lightLogoFileId =
            config.colorsV3?.type === "light"
                ? config.colorsV3?.logo
                : config.colorsV3?.type === "darkAndLight"
                  ? config.colorsV3?.light?.logo
                  : undefined;

        const darkLogoFileId =
            config.colorsV3?.type === "dark"
                ? config.colorsV3.logo
                : config.colorsV3?.type === "darkAndLight"
                  ? config.colorsV3.dark.logo
                  : undefined;

        // Resolve file IDs to FileData
        const resolveFileId = (fileId: string | undefined): FileData | undefined => {
            if (!fileId) {
                return undefined;
            }
            // Cast to any to work around branded type indexing
            const file = (filesV2 as any)[fileId];
            if (!file) {
                return undefined;
            }
            if (file.type === "url") {
                return {
                    src:
                        process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
                            ? file.url.replace(getFileCDN(), `${response.baseUrl.basePath ?? ""}/_files`)
                            : file.url
                };
            } else if (file.type === "image") {
                return {
                    src:
                        process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
                            ? file.url.replace(getFileCDN(), `${response.baseUrl.basePath ?? ""}/_files`)
                            : file.url,
                    width: file.width,
                    height: file.height,
                    blurDataURL: file.blurDataUrl,
                    alt: file.alt
                };
            }
            return undefined;
        };

        const logoUrls = {
            light: resolveFileId(lightLogoFileId),
            dark: resolveFileId(darkLogoFileId)
        };

        kvSet(domainKey, CACHE_KEY_LOGO_URLS, logoUrls, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        console.debug("[getLogoUrls] cache miss, resolved:", logoUrls);
        return logoUrls;
    });

const getFonts = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        unstable_cacheTag(domainKey, "getFonts");

        try {
            const cached = await kvGet<FernFonts>(domainKey, CACHE_KEY_FONTS, cacheConfig.cacheKeySuffix);
            if (cached != null) {
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get fonts for ${domainKey}, fallback to uncached`, error);
        }

        const response = await loadWithUrl(domainKey);
        const fonts = generateFonts(response.definition.config.typographyV2, await getFiles(cacheConfig)(domainKey));
        kvSet(domainKey, CACHE_KEY_FONTS, fonts, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return fonts;
    });

const getLayout = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        unstable_cacheTag(domainKey, "getLayout");

        const config = await getConfig(cacheConfig)(domainKey);
        if (!config) {
            console.error("Could not find config for domainKey", domainKey);
            notFound();
        }

        const logoHeight = config.logoHeight ?? DEFAULT_LOGO_HEIGHT;
        const sidebarWidth = toPx(config.layout?.sidebarWidth) ?? DEFAULT_SIDEBAR_WIDTH;
        const contentWidth = toPx(config.layout?.contentWidth) ?? DEFAULT_CONTENT_WIDTH;
        const pageWidth =
            config.layout?.pageWidth?.type === "full"
                ? undefined
                : (toPx(config.layout?.pageWidth) ?? calcDefaultPageWidth(sidebarWidth, contentWidth));
        const headerHeight = toPx(config.layout?.headerHeight) ?? DEFAULT_HEADER_HEIGHT;
        const tabsPlacement = config.layout?.disableHeader
            ? "SIDEBAR"
            : (config.layout?.tabsPlacement ?? defaultTabsPlacement(domainKey));
        const searchbarPlacement = config.layout?.disableHeader
            ? "SIDEBAR"
            : (config.layout?.searchbarPlacement ?? defaultSearchbarPlacement(domainKey));

        return {
            logoHeight,
            sidebarWidth,
            headerHeight,
            pageWidth,
            contentWidth,
            tabsPlacement,
            searchbarPlacement,
            isHeaderDisabled: config.layout?.disableHeader ?? false,
            hideNavLinks: config.layout?.hideNavLinks ?? false,
            hideFeedback: config.layout?.hideFeedback ?? false
        };
    });

const getDynamicIr = (cacheConfig: Required<CacheConfig>) =>
    cache(async (orgId: string, domain: string, apiName: string) => {
        const api = await getApi(domain, apiName);

        // enable semantic versioning
        const configHash = api.snippetsConfiguration
            ? createHash("sha256").update(JSON.stringify(api.snippetsConfiguration)).digest("hex").slice(0, 16)
            : "no-config";

        try {
            const cached = await kvGet<DynamicIRsByLanguage>(
                domain,
                createDynamicIrCacheKey({ orgId, apiName, configHash }),
                cacheConfig.cacheKeySuffix
            );
            if (cached) {
                console.debug(`Using cached dynamic IR for ${orgId}:${apiName}`);
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get files for ${domain}, fallback to uncached`, error);
        }

        const response = await loadDynamicIRWithUrl({
            orgId,
            apiName,
            snippetsConfig: api.snippetsConfiguration
        });

        if (response) {
            console.debug(`Caching dynamic IR for ${orgId}:${apiName}`);
            kvSet(
                domain,
                createDynamicIrCacheKey({ orgId, apiName, configHash }),
                response,
                cacheConfig.kvTtl,
                cacheConfig.cacheKeySuffix
            );

            return response;
        }

        return undefined;
    });

function defaultTabsPlacement(domainKey: string) {
    const domain = deriveDomainFromDomainKey(domainKey);
    if (domain.includes("cohere")) {
        return "HEADER";
    }
    return "SIDEBAR";
}

function defaultSearchbarPlacement(domainKey: string) {
    const domain = deriveDomainFromDomainKey(domainKey);
    if (domain.includes("cohere")) {
        return "HEADER_TABS";
    }
    return "HEADER";
}

/**
 * The default page width should be at least 1408px (88rem), and should be able to fit 1 content + 2 sidebars
 *
 * The default width for content is 40rem, and the default width for a sidebar is 18rem,
 * so the 2x sidebar + 1x content + 2x gutter = 76rem (1280px),
 * which happens to be the `xl` breakpoint in tailwind as well as the resolution of a 13 inch macbook air.
 *
 * The reason the page width is bumped up to 88rem instead of 76rem is to create a little more breathing room between
 * content and sidebars on a larger screen (such as a 16 inch macbook pro). This is a 8rem (128px) true gutter between the content and sidebars.
 *
 * The 16 inch macbook pro has 1728px (108rem) of width, which results in a 10rem (160px) gutter _around_ the entire page.
 *
 */
function calcDefaultPageWidth(sidebarWidth: number, contentWidth: number) {
    return Math.max(DEFAULT_PAGE_WIDTH, sidebarWidth * 2 + contentWidth + DEFAULT_GUTTER_WIDTH);
}

const getAuthConfig = getAuthEdgeConfig;

const getAskAiEnabledForDocs = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domain: string) => {
        "use cache";
        unstable_cacheTag(domain, "askAiEnabled");

        if (isLocal() || isSelfHosted()) {
            return false;
        }

        try {
            const cached = await kvGet<boolean>(domain, CACHE_KEY_ASK_AI_ENABLED, cacheConfig.cacheKeySuffix);
            if (cached != null) {
                console.debug("[getAskAiEnabled] cache hit:", cached);
                return cached;
            }
        } catch (error) {
            console.warn(`Failed to get askAiEnabled for ${domain}, fallback to uncached`, error);
        }

        let result = false;
        try {
            result = (
                await new FernAIClient({
                    baseUrl: process.env.FAI_SERVER_URL ?? "https://fai.buildwithfern.com",
                    token: process.env.FERN_TOKEN ?? ""
                }).settings.getDocsSettings({ domain })
            ).ask_ai_enabled;

            kvSet(domain, CACHE_KEY_ASK_AI_ENABLED, result, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        } catch (error) {
            console.warn(`Failed to fetch askAiEnabled for ${domain}`, error);
        }
        return result;
    });

// we already cache the API definitions, so no need to cache the types as well
const getTypes = () =>
    cache(async (domainKey: string): Promise<Record<TypeId, TypeDefinition>> => {
        "use cache";
        unstable_cacheTag(domainKey, "getTypes");

        const response = await loadWithUrl(domainKey);
        const allTypes: Record<TypeId, TypeDefinition> = {};

        // Get all types from apisV2
        for (const apiId of Object.keys(response.definition.apisV2)) {
            const api = response.definition.apisV2[ApiDefinitionId(apiId)];
            if (api?.types) {
                Object.assign(allTypes, api.types);
            }
        }

        // Get all types from apis (v1)
        for (const apiId of Object.keys(response.definition.apis)) {
            const v1Api = response.definition.apis[ApiDefinitionId(apiId)];
            if (v1Api) {
                const migratedApi = ApiDefinitionV1ToLatest.from(v1Api).migrate();
                if (migratedApi.types) {
                    Object.assign(allTypes, migratedApi.types);
                }
            }
        }

        return allTypes;
    });

export type DocsLoaderOptions = {
    cacheConfig?: CacheConfig;
    skipAuth?: boolean;
    returnRawMarkdown?: boolean;
};

export type CachedDocsLoader = DocsLoader & {
    clearKvCache: () => Promise<void>;
    isAskAiEnabledForDocs: () => Promise<boolean>;
};

/**
 * The "use cache" tags help us speed up rendering specific parts of the page that are static.
 * It has a hard-limit of 2MB which is why we cannot use it to cache the entire response.
 * The expectation is that moving forward, we'll update the underlying API to be more cache-friendly
 * in a piece-meal fashion, and eventually remove all use of loadWithUrl.
 */
export const createCachedDocsLoader = async (
    host: string,
    domainKey: string,
    fern_token?: string,
    options?: DocsLoaderOptions
): Promise<CachedDocsLoader> => {
    assertDocsDomain(domainKey);

    const config = { ...DEFAULT_CACHE_CONFIG, ...options?.cacheConfig };

    // Force revalidation if requested - only clear KV cache here
    if (config.forceRevalidate) {
        await clearKvCache(domainKey);
    }

    const authConfig = options?.skipAuth ? Promise.resolve(undefined) : getAuthConfig(domainKey);
    const metadata = getMetadata(config)(withoutStaging(domainKey));

    const getAuthState = options?.skipAuth
        ? async (_pathname?: string) => ({
              authed: true as const,
              ok: true as const,
              user: {},
              partner: "custom" as const
          })
        : cache(async (pathname?: string) => {
              const { getAuthState } = await createGetAuthState(
                  host,
                  domainKey,
                  fern_token,
                  await authConfig,
                  await metadata
              );
              return await getAuthState(pathname);
          });

    return {
        domain: deriveDomainFromDomainKey(domainKey),
        fern_token,
        getAuthConfig: () => authConfig,
        getMetadata: () => metadata,
        getFiles: () => getFiles(config)(domainKey),
        getMdxBundlerFiles: () => getMdxBundlerFiles(config)(domainKey),
        getPrunedApi: cache(createGetPrunedApiCached(domainKey, config)),
        getEndpointById: cache((apiDefinitionId: string, endpointId: EndpointId) =>
            getEndpointById({
                domainKey,
                apiDefinitionId,
                endpointId,
                cacheConfig: config
            })
        ),
        getEndpointByLocator: cache(
            unstable_cache(
                (method: HttpMethod, path: string, example?: string) =>
                    getEndpointByLocator(domainKey, method, path, example),
                [domainKey, config.cacheKeySuffix],
                { tags: [domainKey, "endpointByLocator"] }
            )
        ),
        getRoot: async () => getRootCached(config)(domainKey, await getAuthState(), await authConfig),
        getNavigationNode: async (id: string) =>
            getNavigationNode(config)(domainKey, id, await getAuthState(), await authConfig),
        unsafe_getFullRoot: () => unsafe_getRootCached(config)(domainKey),
        getConfig: () => getConfig(config)(domainKey),
        getPage: (pageId) => getPage(config)(domainKey, pageId, options?.returnRawMarkdown),
        getColors: () => getColors(config)(domainKey),
        getLogoUrls: () => getLogoUrls(config)(domainKey),
        getLayout: () => getLayout(config)(domainKey),
        getSettings: () => getSettings(config)(domainKey),
        getLanguage: () => getLanguage(config)(domainKey),
        getFonts: () => getFonts(config)(domainKey),
        getAuthState,
        getEdgeFlags: () => cachedGetEdgeFlags(domainKey),
        getBaseUrl: async () => {
            const m = await metadata;
            return `https://${m.domain}${m.basePath}`;
        },
        getDynamicIr: async (apiName: string) => {
            const m = await metadata;
            return getDynamicIr(config)(m.org, m.domain, apiName);
        },
        getTypes: () => getTypes()(domainKey),
        clearKvCache: () => clearKvCache(domainKey),
        isAskAiEnabledForDocs: () => getAskAiEnabledForDocs(config)(domainKey)
    };
};

function toOklch(color: object | undefined): string | undefined {
    if (!color || !isPlainObject(color)) {
        return undefined;
    }

    if (
        "r" in color &&
        typeof color.r === "number" &&
        "g" in color &&
        typeof color.g === "number" &&
        "b" in color &&
        typeof color.b === "number"
    ) {
        if ("a" in color && typeof color.a === "number") {
            return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
        }
        return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    return undefined;
}

export function toPx(
    config: { type: "px"; value: number } | { type: "rem"; value: number } | undefined
): number | undefined {
    if (!config) {
        return undefined;
    }
    if (config.type === "px") {
        return config.value;
    }
    return config.value * 16;
}

export function createPruneKey(node: FernNavigation.NavigationNodeApiLeaf): PruningNodeType {
    switch (node.type) {
        case "endpoint":
            return {
                type: "endpoint",
                endpointId: node.endpointId
            };
        case "webSocket":
            return {
                type: "webSocket",
                webSocketId: node.webSocketId
            };
        case "webhook":
            return {
                type: "webhook",
                webhookId: node.webhookId
            };
        case "grpc":
            return {
                type: "grpc",
                grpcId: node.grpcId
            };
        default:
            throw new Error(`Unknown node type: ${node}`);
    }
}

function getFileCDN() {
    return (
        (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FILES_ORIGIN : undefined) ??
        "https://files.buildwithfern.com"
    );
}
