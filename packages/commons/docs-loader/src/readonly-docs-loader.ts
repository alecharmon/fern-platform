import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import {
    type AuthState,
    loadWithUrl as cachedLoadWithUrl,
    cleanBasePath,
    createGetAuthState,
    type DynamicIRsByLanguage,
    type FernFonts,
    findEndpoint,
    findWebhook,
    generateFernColorPalette,
    generateFonts,
    getDocsUrlMetadata,
    isDocsDev,
    isLocal,
    isSelfHosted,
    provideRegistryService,
    pruneWithAuthState,
    pruneWithPasswordAuth,
    track,
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
import {
    type APIV1Read,
    type ApiDefinition,
    type DocsV1Read,
    type DocsV2Read,
    FernNavigation
} from "@fern-api/fdr-sdk";
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
import { ApiDefinitionId, EndpointId, type Slug, type TypeId } from "@fern-api/fdr-sdk/navigation";
import type { DocsDeploymentStatus } from "@fern-api/fdr-sdk/orpc-client";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish, isPlainObject } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { visualEditorStorage } from "@fern-api/visual-editor-server";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";
import { createHash } from "crypto";
import { mapValues } from "es-toolkit";
import { cacheTag, unstable_cache } from "next/cache";
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
import { resolveApiDefinition } from "./resolve-api";

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
            logger.warn(`Failed to get FDR snapshot for ${domain}:${branchName}, fallback to uncached`, error);
        }
    }
    if (branchName) {
        const response = await uncachedLoadWithUrl(domain);
        // Do not await this, we want to return the loadWithUrl response immediately
        visualEditorStorage
            .storeFdrSnapshot(domain, branchName, response)
            .then(() => {
                logger.info(`[loadWithUrl] FDR snapshot stored for ${domain}:${branchName}`);
            })
            .catch((error) => {
                logger.error(`[loadWithUrl] Failed to store FDR snapshot for ${domain}:${branchName}`, error);
            });
        return response;
    } else {
        const response = await cachedLoadWithUrl(domain);
        return response;
    }
};
const loadDynamicIRWithUrl = uncachedLoadDynamicIRWithUrl;

/*
 * The domainKey originates from middleware.ts, which encodes the matched basepath
 * into the domain (e.g. "example.com/repo1" or "example.com/nemo/nemo-rl").
 * The path portion can be arbitrary depth.
 *
 * Examples:
 *   "example.com"                → domain="example.com"
 *   "example.com/repo1"          → domain="example.com", s3path="/repo1"
 *   "example.com/nemo/nemo-rl"   → domain="example.com", s3path="/nemo/nemo-rl"
 */
export function encodeDocsLoaderDomain(domain: string, branchName?: string) {
    return branchName ? `${domain}::${branchName}` : domain;
}

function decodeDocsLoaderDomainKey(domainKey: string) {
    const [domainWithBasepath = domainKey, branchName] = domainKey.split("::");
    return { domain: domainWithBasepath, branchName };
}

function deriveDomainFromS3Path(domainKey: string) {
    const { domain } = decodeDocsLoaderDomainKey(domainKey);
    const decoded = decodeURIComponent(domain);
    const slashIndex = decoded.indexOf("/");
    return slashIndex === -1 ? decoded : decoded.slice(0, slashIndex);
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
    const domain = deriveDomainFromS3Path(domainKey);
    const isPreview = process.env.VERCEL_ENV === "preview";

    if (FERN_DOCS_ORIGINS.includes(domain)) {
        throw new Error(`[assertDocsDomain] Found unexpected domain (FERN_DOCS_ORIGINS)`);
    }

    if (!isPreview && domain.endsWith(".vercel.app")) {
        throw new Error(`[assertDocsDomain:${domain}] Found unexpected domain (.vercel.app in production)`);
    }
}

function kvSet(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string) {
    kvCache.set(domainKey, key, value, ttl, cacheKeySuffix);
}

async function kvGet<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null> {
    return kvCache.get<T>(domainKey, key, cacheKeySuffix);
}

async function kvMget(domainKey: string, keys: string[], cacheKeySuffix?: string): Promise<Map<string, unknown>> {
    return kvCache.mget(domainKey, keys, cacheKeySuffix);
}

export async function batchGetCommonMetadata(
    domainKey: string,
    cacheConfig: Required<CacheConfig>
): Promise<{
    metadata: DocsMetadata | null;
    config: Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root"> | null;
    root: FernNavigation.RootNode | null;
    files: Record<string, FileData> | null;
    colors: {
        light: FernColorTheme | undefined;
        dark: FernColorTheme | undefined;
    } | null;
    logoUrls: { light?: FileData; dark?: FileData } | null;
    fonts: FernFonts | null;
    mdxBundlerFiles: Record<string, string> | null;
    askAiEnabled: boolean | null;
}> {
    const keys = [
        CACHE_KEY_METADATA,
        CACHE_KEY_CONFIG,
        CACHE_KEY_ROOT,
        CACHE_KEY_FILES,
        CACHE_KEY_COLORS,
        CACHE_KEY_LOGO_URLS,
        CACHE_KEY_FONTS,
        CACHE_KEY_MDX_BUNDLER_FILES,
        CACHE_KEY_ASK_AI_ENABLED
    ];

    const results = await kvMget(domainKey, keys, cacheConfig.cacheKeySuffix);

    return {
        metadata: (results.get(CACHE_KEY_METADATA) as DocsMetadata) ?? null,
        config:
            (results.get(CACHE_KEY_CONFIG) as Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">) ?? null,
        root: (results.get(CACHE_KEY_ROOT) as FernNavigation.RootNode) ?? null,
        files: (results.get(CACHE_KEY_FILES) as Record<string, FileData>) ?? null,
        colors:
            (results.get(CACHE_KEY_COLORS) as {
                light: FernColorTheme | undefined;
                dark: FernColorTheme | undefined;
            }) ?? null,
        logoUrls:
            (results.get(CACHE_KEY_LOGO_URLS) as {
                light?: FileData;
                dark?: FileData;
            }) ?? null,
        fonts: (results.get(CACHE_KEY_FONTS) as FernFonts) ?? null,
        mdxBundlerFiles: (results.get(CACHE_KEY_MDX_BUNDLER_FILES) as Record<string, string>) ?? null,
        askAiEnabled: (results.get(CACHE_KEY_ASK_AI_ENABLED) as boolean) ?? null
    };
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
        logger.debug(`In-memory config cache cleared for domainKey: ${domainKey} (${keysToDelete.length} entries)`);
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
    return await getEdgeFlags(deriveDomainFromS3Path(domainKey));
});

export const getMetadataFromResponse = async (
    domainKey: string,
    responsePromise: AsyncOrSync<DocsV2Read.LoadDocsForUrlResponse>
): Promise<DocsMetadata> => {
    assertDocsDomain(domainKey);
    const [response, docsUrlMetadata] = await Promise.all([
        responsePromise,
        getDocsUrlMetadata(deriveDomainFromS3Path(domainKey))
    ]);

    const isSelfHostedMode = isSelfHosted();
    const fdrBasePath = response.baseUrl.basePath;
    const nextBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
    const finalBasePath = isSelfHostedMode ? cleanBasePath(nextBasePath) : cleanBasePath(fdrBasePath);

    logger.debug("[docs-loader] basePath resolution:", {
        isSelfHosted: isSelfHostedMode,
        fdrBasePath,
        nextBasePath,
        finalBasePath,
        domain: response.baseUrl.domain
    });

    return {
        domain: response.baseUrl.domain,
        // In self-hosted mode, use the Next.js basePath instead of the FDR basePath
        // This allows the app to be served from a single basePath for all routes
        basePath: finalBasePath,
        url: docsUrlMetadata.url,
        org: docsUrlMetadata.org,
        isPreview: docsUrlMetadata.isPreview
    };
};

export const getMetadata = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string): Promise<DocsMetadata> => {
        "use cache";
        cacheTag(domainKey, "getMetadata");
        assertDocsDomain(domainKey);

        const kvGetStart = Date.now();
        logger.debug(`[DocsLoader] getMetadata kvGet start - domain: ${domainKey}, key: ${CACHE_KEY_METADATA}`);
        try {
            const cached = DocsMetadataSchema.safeParse(
                await kvGet<DocsMetadata>(domainKey, CACHE_KEY_METADATA, cacheConfig.cacheKeySuffix)
            );
            const kvGetDuration = Date.now() - kvGetStart;
            logger.debug(`[DocsLoader] getMetadata kvGet done in ${kvGetDuration}ms - domain: ${domainKey}`);
            if (cached.success) {
                logger.debug("[getMetadata] cache hit:", cached.data);
                return cached.data;
            }
        } catch (error) {
            const kvGetDuration = Date.now() - kvGetStart;
            logger.warn(
                `Failed to get metadata for ${domainKey} from kv in ${kvGetDuration}ms, fallback to uncached`,
                error
            );
        }

        const loadStart = Date.now();
        logger.debug(`[DocsLoader] getMetadata loadWithUrl start - domain: ${domainKey}`);
        const metadata = await getMetadataFromResponse(domainKey, loadWithUrl(domainKey));
        const loadDuration = Date.now() - loadStart;
        logger.debug(`[DocsLoader] getMetadata loadWithUrl done in ${loadDuration}ms - domain: ${domainKey}`);
        kvSet(domainKey, CACHE_KEY_METADATA, metadata, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        logger.debug("[getMetadata] cache miss:", metadata);
        return metadata;
    });

const getFiles = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domain: string): Promise<Record<string, FileData>> => {
        "use cache";
        cacheTag(domain, "getFiles");

        let cacheHit = false;
        try {
            const cached = await kvGet<Record<string, FileData>>(domain, CACHE_KEY_FILES, cacheConfig.cacheKeySuffix);
            if (cached) {
                cacheHit = true;
                return cached;
            }
        } catch (error) {
            logger.warn(`Failed to get files for ${domain}, fallback to uncached`, error);
            track("asset_error", {
                type: "get_files_kv_error",
                domain,
                error: String(error)
            });
        }

        try {
            const response = await loadWithUrl(domain);
            const files = mapValues(response.definition.filesV2, (file) => {
                if (file == null) {
                    return { src: "" };
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
                throw new UnreachableCaseError(file);
            });

            const filesCount = Object.keys(files).length;
            if (filesCount === 0) {
                track("asset_error", {
                    type: "get_files_empty",
                    domain,
                    cacheHit
                });
            }

            kvSet(domain, CACHE_KEY_FILES, files, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
            return files;
        } catch (error) {
            logger.error(`Failed to load files for ${domain}`, error);
            track("asset_error", {
                type: "get_files_load_error",
                domain,
                error: String(error)
            });
            // Return empty object so pages can still render (just without images)
            return {};
        }
    });

// the api reference may be too large to cache, so we don't cache it in the KV store
const getApi = async (domainKey: string, id: string): Promise<ApiDefinition.ApiDefinition> => {
    const response = await loadWithUrl(domainKey);
    const definitionKeys = Object.keys(response.definition ?? {});
    const apisV2Keys = Object.keys((response.definition.apisV2 as Record<string, unknown>) ?? {});
    const apisV1Keys = Object.keys((response.definition.apis as Record<string, unknown>) ?? {});
    logger.debug(
        `[getApi] domain=${domainKey}, id=${id}, definitionKeys=[${definitionKeys.join(", ")}], apisV2Ids=[${apisV2Keys.join(", ")}], apisV1Ids=[${apisV1Keys.join(", ")}]`
    );
    return resolveApiDefinition(
        id,
        (response.definition.apisV2 as Record<string, unknown>) ?? {},
        (response.definition.apis as Record<string, unknown>) ?? {},
        provideRegistryService().api,
        domainKey
    );
};

/**
 * Error thrown when a pruned API result is missing expected nodes.
 * Throwing prevents unstable_cache from caching the empty result,
 * so the next request will retry fresh instead of serving stale data.
 */
class PruneEmptyError extends Error {
    constructor(domainKey: string, id: string, nodes: PruningNodeType[]) {
        const nodeDescriptions = nodes.map(
            (n) =>
                `${n.type}:${"endpointId" in n ? n.endpointId : "webSocketId" in n ? n.webSocketId : "webhookId" in n ? n.webhookId : "unknown"}`
        );
        super(
            `[DocsLoader] Pruned result missing expected nodes for ${domainKey}:${id} - requested: [${nodeDescriptions.join(", ")}]`
        );
        this.name = "PruneEmptyError";
    }
}

/**
 * Checks whether a pruned API definition contains the expected nodes.
 */
function hasExpectedNodes(pruned: ApiDefinition.ApiDefinition, nodes: PruningNodeType[]): boolean {
    for (const node of nodes) {
        switch (node.type) {
            case "endpoint":
                if (pruned.endpoints[node.endpointId] == null) {
                    return false;
                }
                break;
            case "webSocket":
                if (pruned.websockets[node.webSocketId] == null) {
                    return false;
                }
                break;
            case "webhook":
                if (pruned.webhooks[node.webhookId] == null) {
                    return false;
                }
                break;
            case "grpc":
                if (pruned.endpoints[EndpointId(node.grpcId)] == null) {
                    return false;
                }
                break;
            case "graphql":
                if (pruned.graphqlOperations[node.graphqlOperationId] == null) {
                    return false;
                }
                break;
        }
    }
    return true;
}

const createGetPrunedApiCached = (domainKey: string, cacheConfig: Required<CacheConfig>) => {
    const cachedFn = unstable_cache(
        async (id: string, ...nodes: PruningNodeType[]): Promise<ApiDefinition.ApiDefinition> => {
            // if there is only one node, and it's an endpoint, try to load from cache
            const kvGetStart = Date.now();
            try {
                if (nodes.length === 1 && nodes[0]) {
                    const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
                    logger.debug(
                        `[DocsLoader] createGetPrunedApiCached kvGet start - domain: ${domainKey}, key: ${key}, apiId: ${id}`
                    );
                    const cached = await kvGet<ApiDefinition.ApiDefinition>(domainKey, key, cacheConfig.cacheKeySuffix);
                    const kvGetDuration = Date.now() - kvGetStart;
                    logger.debug(
                        `[DocsLoader] createGetPrunedApiCached kvGet done in ${kvGetDuration}ms - domain: ${domainKey}, key: ${key}`
                    );
                    if (cached != null) {
                        if (hasExpectedNodes(cached, nodes)) {
                            logger.debug(
                                `[DocsLoader] createGetPrunedApiCached cache hit (valid) - domain: ${domainKey}, key: ${key}`
                            );
                            return cached;
                        }
                        logger.warn(
                            `[DocsLoader] createGetPrunedApiCached cache hit but STALE (missing expected nodes) - domain: ${domainKey}, key: ${key}`
                        );
                    } else {
                        logger.debug(
                            `[DocsLoader] createGetPrunedApiCached cache miss, falling back to getApi - domain: ${domainKey}, key: ${key}`
                        );
                    }
                }
            } catch (error) {
                const kvGetDuration = Date.now() - kvGetStart;
                logger.warn(
                    `Failed to get pruned api for ${domainKey}:${id} in ${kvGetDuration}ms, fallback to uncached`,
                    error
                );
            }

            const getApiStart = Date.now();
            logger.debug(`[DocsLoader] createGetPrunedApiCached getApi start - domain: ${domainKey}, apiId: ${id}`);
            const api = await getApi(domainKey, id);
            const getApiDuration = Date.now() - getApiStart;
            logger.debug(
                `[DocsLoader] createGetPrunedApiCached getApi done in ${getApiDuration}ms - domain: ${domainKey}, apiId: ${id}`
            );

            const pruned = prune(api, ...nodes);
            for (const endpointK of Object.keys(pruned.endpoints)) {
                if (pruned.endpoints[EndpointId(endpointK)]?.environments?.length === 0) {
                    logger.debug(`${endpointK} has empty environments, adding default URL.`);
                    pruned.endpoints[EndpointId(endpointK)]?.environments?.push({
                        id: "Default" as EnvironmentId,
                        baseUrl: "https://host.com",
                        audiences: undefined
                    });
                }
            }

            // Don't cache or write empty/stale prune results
            if (!hasExpectedNodes(pruned, nodes)) {
                logger.warn(
                    `[DocsLoader] createGetPrunedApiCached pruned result missing expected nodes - domain: ${domainKey}, apiId: ${id}. Throwing to prevent caching.`
                );
                throw new PruneEmptyError(domainKey, id, nodes);
            }

            // Only write to KV if the result contains expected nodes
            if (nodes.length === 1 && nodes[0]) {
                const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
                kvSet(domainKey, key, pruned, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
            }
            return pruned;
        },
        [domainKey, cacheConfig.cacheKeySuffix],
        { tags: [domainKey, "api"] }
    );

    // Wrap to gracefully handle PruneEmptyError — return empty API definition
    // so callers (e.g. createEndpointContext) can handle missing data with a 404
    // instead of a 500, while the unstable_cache entry remains un-cached for retry.
    return async (id: string, ...nodes: PruningNodeType[]): Promise<ApiDefinition.ApiDefinition> => {
        try {
            return await cachedFn(id, ...nodes);
        } catch (error) {
            if (error instanceof PruneEmptyError) {
                logger.warn(error.message);
                return {
                    id: ApiDefinitionId(id),
                    endpoints: {},
                    websockets: {},
                    webhooks: {},
                    types: {},
                    subpackages: {},
                    auths: [],
                    globalHeaders: [],
                    graphqlOperations: {}
                } as unknown as ApiDefinition.ApiDefinition;
            }
            throw error;
        }
    };
};

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
        case "graphql":
            return `graphql:${pruneType.graphqlOperationId}`;
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
    cacheTag(domainKey, "getEndpointById", apiDefinitionId, endpointId);

    const api = await createGetPrunedApiCached(domainKey, cacheConfig)(apiDefinitionId, {
        type: "endpoint",
        endpointId
    });

    const endpoint = api.endpoints[endpointId];
    if (endpoint == null) {
        throw new Error(`[getEndpointById] Could not find endpoint with ID ${endpointId}`);
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

const getEndpointByLocator =
    (cacheConfig: Required<CacheConfig>) =>
    async (
        domainKey: string,
        method: HttpMethod,
        path: string,
        example?: string,
        apiName?: string
    ): Promise<{
        apiDefinitionId: ApiDefinition.ApiDefinitionId;
        endpointId: EndpointId;
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
            // If apiName is specified, only search within that API
            // Use api.apiName (folder name) for consistency with getTypes
            if (apiName != null && api.apiName !== apiName) {
                continue;
            }
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
                            node.type === "endpoint" &&
                            node.apiDefinitionId === api.id &&
                            node.endpointId === endpoint.id
                    )
                    .map((node) => node.slug);

                return {
                    apiDefinitionId: api.id,
                    endpointId: endpoint.id,
                    slugs
                };
            }
        }
        throw new Error(
            `[getEndpointByLocator] Could not find endpoint ${method} ${path}${apiName ? ` in API "${apiName}"` : ""}`
        );
    };

const getWebhookByLocator = async (
    domainKey: string,
    webhookId: string
): Promise<
    | {
          apiDefinitionId: ApiDefinition.ApiDefinitionId;
          webhook: ApiDefinition.WebhookDefinition;
          slug: Slug | undefined;
      }
    | undefined
> => {
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
        const webhook = findWebhook({
            apiDefinition: api,
            webhookId
        });
        if (webhook != null) {
            const webhookNode = FernNavigation.NodeCollector.collect(root)
                .getNodesInOrder()
                .filter(FernNavigation.hasMetadata)
                .find(
                    (node) =>
                        node.type === "webhook" && node.apiDefinitionId === api.id && node.webhookId === webhook.id
                );
            return {
                apiDefinitionId: api.id,
                webhook,
                slug: webhookNode?.slug
            };
        }
    }
    logger.error(`Could not find webhook ${webhookId}`);
    return undefined;
};

export function convertResponseToRootNode(response: DocsV2Read.LoadDocsForUrlResponse, edgeFlags: EdgeFlags) {
    let root: FernNavigation.RootNode | undefined;
    if (response.definition.config.root) {
        root = FernNavigation.migrate.FernNavigationV1ToLatest.create().root(
            response.definition.config.root as FernNavigation.V1.RootNode
        );
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
        logger.warn(`Failed to get full root for ${domainKey}, fallback to uncached`, error);
    }
    const response = await loadWithUrl(domainKey);
    const root = convertResponseToRootNode(response, await cachedGetEdgeFlags(domainKey));
    if (root == null) {
        throw new Error(`[unsafe_getFullRoot] Could not find root node for domainKey ${domainKey}`);
    }
    return root;
};

const unsafe_getRootCached = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        return await unstable_cache(
            async (domainKey: string) => {
                const kvGetStart = Date.now();
                logger.debug(
                    `[DocsLoader] unsafe_getRootCached kvGet start - domain: ${domainKey}, key: ${CACHE_KEY_ROOT}`
                );
                try {
                    const cached = await kvGet<FernNavigation.RootNode>(
                        domainKey,
                        CACHE_KEY_ROOT,
                        cacheConfig.cacheKeySuffix
                    );
                    const kvGetDuration = Date.now() - kvGetStart;
                    logger.debug(
                        `[DocsLoader] unsafe_getRootCached kvGet done in ${kvGetDuration}ms - domain: ${domainKey}`
                    );
                    if (cached != null) {
                        return cached;
                    }
                } catch (error) {
                    const kvGetDuration = Date.now() - kvGetStart;
                    logger.warn(
                        `Failed to get full root for ${domainKey} in ${kvGetDuration}ms, fallback to uncached`,
                        error
                    );
                }

                // Get fresh data
                const loadStart = Date.now();
                logger.debug(`[DocsLoader] unsafe_getRootCached unsafe_getFullRoot start - domain: ${domainKey}`);
                const root = await unsafe_getFullRoot(domainKey);
                const loadDuration = Date.now() - loadStart;
                logger.debug(
                    `[DocsLoader] unsafe_getRootCached unsafe_getFullRoot done in ${loadDuration}ms - domain: ${domainKey}`
                );

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
    if (authConfig?.type === "password") {
        root = pruneWithPasswordAuth(authState, root);
    } else if (authConfig) {
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
            throw new Error(`[getNavigationNode] Could not find node ${id} for domainKey ${domainKey}`);
        }
        return node;
    });

const getSettings = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getSettings");

        const config = await getConfig(cacheConfig)(domainKey);
        if (!config) {
            throw new Error(`[getSettings] Could not find config for domainKey ${domainKey}`);
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
            language: settings?.language ?? "en"
        };
    });

const getTheme = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getTheme");

        const config = await getConfig(cacheConfig)(domainKey);
        if (!config) {
            throw new Error(`[getTheme] Could not find config for domainKey ${domainKey}`);
        }

        const theme = config.theme;

        return {
            sidebar: theme?.sidebar ?? "default",
            tabs: theme?.tabs ?? "default",
            body: theme?.body ?? "default",
            productSwitcher: theme?.["product-switcher"] ?? "default"
        };
    });

const getLanguage = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getLanguage");

        const config = await getConfig(cacheConfig)(domainKey);
        if (!config) {
            throw new Error(`[getLanguage] Could not find config for domainKey ${domainKey}`);
        }

        return config.settings?.language ?? "en";
    });

const getConfig = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        let result = await (async () => {
            // Skip in-memory cache in local development to ensure fresh CSS/config on hot reload
            if (!isLocal()) {
                // Check in-memory cache first
                const cacheKey = cacheConfig.cacheKeySuffix
                    ? `${domainKey}:config:${cacheConfig.cacheKeySuffix}`
                    : `${domainKey}:config`;
                const inMemoryCached =
                    getFromInMemoryCache<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">>(cacheKey);
                if (inMemoryCached != null) {
                    logger.debug(`[getConfig] in-memory cache hit for ${domainKey}`);
                    return inMemoryCached;
                }
            }

            const kvGetStart = Date.now();
            logger.debug(`[DocsLoader] getConfig kvGet start - domain: ${domainKey}, key: ${CACHE_KEY_CONFIG}`);
            try {
                const cached = await kvGet<Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">>(
                    domainKey,
                    CACHE_KEY_CONFIG,
                    cacheConfig.cacheKeySuffix
                );
                const kvGetDuration = Date.now() - kvGetStart;
                logger.debug(`[DocsLoader] getConfig kvGet done in ${kvGetDuration}ms - domain: ${domainKey}`);
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
                const kvGetDuration = Date.now() - kvGetStart;
                logger.warn(`Failed to get config for ${domainKey} in ${kvGetDuration}ms, fallback to uncached`, error);
            }

            const loadStart = Date.now();
            logger.debug(`[DocsLoader] getConfig loadWithUrl start - domain: ${domainKey}`);
            const response = await loadWithUrl(domainKey);
            const loadDuration = Date.now() - loadStart;
            logger.debug(`[DocsLoader] getConfig loadWithUrl done in ${loadDuration}ms - domain: ${domainKey}`);
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
        })();

        return result;
    });

const getPage = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string, pageId: string, returnRawMarkdown: boolean = false) => {
        const pageCacheKey = createPageCacheKey({ pageId });
        const kvGetStart = Date.now();
        logger.debug(
            `[DocsLoader] getPage kvGet start - domain: ${domainKey}, key: ${pageCacheKey}, pageId: ${pageId}`
        );
        try {
            const page = await kvGet<DocsV1Read.PageContent>(domainKey, pageCacheKey, cacheConfig.cacheKeySuffix);
            const kvGetDuration = Date.now() - kvGetStart;
            logger.debug(
                `[DocsLoader] getPage kvGet done in ${kvGetDuration}ms - domain: ${domainKey}, pageId: ${pageId}`
            );
            if (page != null && isPlainObject(page) && "markdown" in page) {
                const config = await getConfig(cacheConfig)(domainKey);
                return {
                    filename: pageId,
                    markdown: page.markdown,
                    editThisPageUrl: page.editThisPageUrl,
                    editThisPageLaunch: page.editThisPageLaunch,
                    css: config.css,
                    rawMarkdown: returnRawMarkdown ? page.rawMarkdown : undefined
                };
            }
        } catch (error) {
            const kvGetDuration = Date.now() - kvGetStart;
            logger.warn(
                `Failed to get page for ${domainKey}:${pageId} in ${kvGetDuration}ms, fallback to uncached`,
                error
            );
        }

        const loadStart = Date.now();
        logger.debug(`[DocsLoader] getPage loadWithUrl start - domain: ${domainKey}, pageId: ${pageId}`);
        const response = await loadWithUrl(domainKey);
        const loadDuration = Date.now() - loadStart;
        logger.debug(
            `[DocsLoader] getPage loadWithUrl done in ${loadDuration}ms - domain: ${domainKey}, pageId: ${pageId}`
        );
        const page = (
            response.definition.pages as Record<
                string,
                {
                    markdown: string;
                    editThisPageUrl?: string;
                    editThisPageLaunch?: "github" | "dashboard";
                    rawMarkdown?: string;
                }
            >
        )[pageId];
        if (page == null) {
            throw new Error(`[getPage] Could not find page with ID ${pageId}`);
        }

        kvSet(domainKey, pageCacheKey, page, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return {
            filename: pageId,
            markdown: page.markdown,
            editThisPageUrl: page.editThisPageUrl,
            editThisPageLaunch: page.editThisPageLaunch,
            css: response.definition.config.css,
            rawMarkdown: returnRawMarkdown ? page.rawMarkdown : undefined
        };
    });

const getMdxBundlerFiles = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getMdxBundlerFiles");

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
            logger.warn(`Failed to get mdx bundler files for ${domainKey}, fallback to uncached`, error);
        }

        const response = await loadWithUrl(domainKey);
        const files = response.definition.jsFiles ?? {};
        kvSet(domainKey, CACHE_KEY_MDX_BUNDLER_FILES, files, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return files;
    });

const getColors = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getColors");

        try {
            const cached = await kvGet<{
                light: FernColorTheme | undefined;
                dark: FernColorTheme | undefined;
            }>(domainKey, CACHE_KEY_COLORS, cacheConfig.cacheKeySuffix);
            if (cached) {
                return cached;
            }
        } catch (error) {
            logger.warn(`Failed to get colors for ${domainKey}, fallback to uncached`, error);
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
                          cardBackground: toOklch(light.cardBackground),
                          accentScaleOverrides: {
                              accent1: toOklch(light.accent1),
                              accent2: toOklch(light.accent2),
                              accent3: toOklch(light.accent3),
                              accent4: toOklch(light.accent4),
                              accent5: toOklch(light.accent5),
                              accent6: toOklch(light.accent6),
                              accent7: toOklch(light.accent7),
                              accent8: toOklch(light.accent8),
                              accent9: toOklch(light.accent9),
                              accent10: toOklch(light.accent10),
                              accent11: toOklch(light.accent11),
                              accent12: toOklch(light.accent12)
                          }
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
                          cardBackground: toOklch(dark.cardBackground),
                          accentScaleOverrides: {
                              accent1: toOklch(dark.accent1),
                              accent2: toOklch(dark.accent2),
                              accent3: toOklch(dark.accent3),
                              accent4: toOklch(dark.accent4),
                              accent5: toOklch(dark.accent5),
                              accent6: toOklch(dark.accent6),
                              accent7: toOklch(dark.accent7),
                              accent8: toOklch(dark.accent8),
                              accent9: toOklch(dark.accent9),
                              accent10: toOklch(dark.accent10),
                              accent11: toOklch(dark.accent11),
                              accent12: toOklch(dark.accent12)
                          }
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
        cacheTag(domainKey, "getLogoUrls");

        try {
            const cached = await kvGet<{ light?: FileData; dark?: FileData }>(
                domainKey,
                CACHE_KEY_LOGO_URLS,
                cacheConfig.cacheKeySuffix
            );
            if (cached != null) {
                logger.debug("[getLogoUrls] cache hit");
                return cached;
            }
        } catch (error) {
            logger.warn(`Failed to get logo URLs for ${domainKey}, fallback to uncached`, error);
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
        logger.debug("[getLogoUrls] cache miss, resolved:", logoUrls);
        return logoUrls;
    });

const getFonts = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getFonts");

        try {
            const cached = await kvGet<FernFonts>(domainKey, CACHE_KEY_FONTS, cacheConfig.cacheKeySuffix);
            if (cached != null) {
                return cached;
            }
        } catch (error) {
            logger.warn(`Failed to get fonts for ${domainKey}, fallback to uncached`, error);
        }

        const response = await loadWithUrl(domainKey);
        const fonts = generateFonts(response.definition.config.typographyV2, await getFiles(cacheConfig)(domainKey));
        kvSet(domainKey, CACHE_KEY_FONTS, fonts, cacheConfig.kvTtl, cacheConfig.cacheKeySuffix);
        return fonts;
    });

const getLayout = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domainKey: string) => {
        "use cache";
        cacheTag(domainKey, "getLayout");

        const config = await getConfig(cacheConfig)(domainKey);
        if (!config) {
            throw new Error(`[getLayout] Could not find config for domainKey ${domainKey}`);
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
        const switcherPlacement = config.layout?.disableHeader
            ? "SIDEBAR"
            : (config.layout?.switcherPlacement ?? defaultSwitcherPlacement(domainKey));

        return {
            logoHeight,
            sidebarWidth,
            headerHeight,
            pageWidth,
            contentWidth,
            tabsPlacement,
            searchbarPlacement,
            switcherPlacement,
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
                logger.debug(`Using cached dynamic IR for ${orgId}:${apiName}`);
                return cached;
            }
        } catch (error) {
            logger.warn(`Failed to get files for ${domain}, fallback to uncached`, error);
        }

        const response = await loadDynamicIRWithUrl({
            orgId,
            apiName,
            snippetsConfig: api.snippetsConfiguration ?? undefined,
            domain
        });

        if (response) {
            logger.debug(`Caching dynamic IR for ${orgId}:${apiName}`);
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
    const domain = deriveDomainFromS3Path(domainKey);
    if (domain.includes("cohere")) {
        return "HEADER";
    }
    return "SIDEBAR";
}

function defaultSearchbarPlacement(domainKey: string) {
    const domain = deriveDomainFromS3Path(domainKey);
    if (domain.includes("cohere")) {
        return "HEADER_TABS";
    }
    return "HEADER";
}

function defaultSwitcherPlacement(_domainKey: string): "HEADER" | "SIDEBAR" {
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

const getDocsDeploymentStatus = (cacheConfig: Required<CacheConfig>) =>
    // This function uses a Next.js cache to cache rather than a KV cache since this is small and needs to be
    // invalidated/revalidated from other services.
    cache(async (domain: string, basepath?: string): Promise<DocsDeploymentStatus | null> => {
        "use cache";
        cacheTag(domain, "docsDeploymentStatus");

        if (isLocal() || isSelfHosted()) {
            return null;
        }

        let result: DocsDeploymentStatus | null = null;
        try {
            const fdrOrigin = process.env.NEXT_PUBLIC_FDR_ORIGIN ?? "https://registry.buildwithfern.com";
            const params = new URLSearchParams({ domain });
            if (basepath) {
                params.set("basepath", basepath);
            }
            const token = process.env.FERN_TOKEN;
            const response = await fetch(`${fdrOrigin}/docs-deployment/status?${params.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            });
            if (!response.ok) {
                logger.warn(`[getDocsDeploymentStatus] Failed to fetch status for ${domain}: ${response.status}`);
                return null;
            }
            const data = (await response.json()) as { status: DocsDeploymentStatus | null };
            result = data.status;
        } catch (error) {
            logger.warn(`[getDocsDeploymentStatus] Failed to fetch status for ${domain}`, error);
        }
        return result;
    });

const getAskAiEnabledForDocs = (cacheConfig: Required<CacheConfig>) =>
    cache(async (domain: string) => {
        "use cache";
        cacheTag(domain, "askAiEnabled");

        if (isLocal() || isSelfHosted()) {
            return false;
        }

        try {
            const cached = await kvGet<boolean>(domain, CACHE_KEY_ASK_AI_ENABLED, cacheConfig.cacheKeySuffix);
            if (cached != null) {
                logger.debug("[getAskAiEnabled] cache hit:", cached);
                return cached;
            }
        } catch (error) {
            logger.warn(`Failed to get askAiEnabled for ${domain}, fallback to uncached`, error);
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
            logger.warn(`Failed to fetch askAiEnabled for ${domain}`, error);
        }
        return result;
    });

const getTypes = () =>
    cache(async (domainKey: string, apiName?: string): Promise<Record<TypeId, TypeDefinition>> => {
        "use cache";
        cacheTag(domainKey, "getTypes", apiName ?? "all");

        const response = await loadWithUrl(domainKey);
        const allTypes: Record<TypeId, TypeDefinition> = {};

        // Get all types from apisV2
        for (const apiId of Object.keys(response.definition.apisV2)) {
            const api = (response.definition.apisV2 as Record<string, any>)[apiId];
            if (api?.types && (apiName == null || api.apiName === apiName)) {
                Object.assign(allTypes, api.types);
            }
        }

        // Get all types from apis (v1)
        for (const apiId of Object.keys(response.definition.apis)) {
            const v1Api = (response.definition.apis as Record<string, unknown>)[apiId];
            if (v1Api != null) {
                const migratedApi = ApiDefinitionV1ToLatest.from(v1Api as APIV1Read.ApiDefinition).migrate();
                if (apiName == null || migratedApi.apiName === apiName) {
                    if (migratedApi.types) {
                        Object.assign(allTypes, migratedApi.types);
                    }
                }
            }
        }

        if (Object.keys(allTypes).length === 0 && response.definition.apiNameToId != null) {
            const apiNameToId = response.definition.apiNameToId;

            if (apiName != null) {
                const apiDefinitionId = apiNameToId[apiName];
                if (apiDefinitionId != null) {
                    const api = await getApi(domainKey, apiDefinitionId);
                    if (api.types) {
                        Object.assign(allTypes, api.types);
                    }
                }
            } else {
                const fetchPromises = Object.entries(apiNameToId).map(async ([_, apiDefinitionId]) => {
                    const api = await getApi(domainKey, apiDefinitionId);
                    return api.types ?? {};
                });
                const results = await Promise.all(fetchPromises);
                for (const types of results) {
                    Object.assign(allTypes, types);
                }
            }
        }

        return allTypes;
    });

export type DocsLoaderOptions = {
    cacheConfig?: CacheConfig;
    skipAuth?: boolean;
    returnRawMarkdown?: boolean;
    /**
     * Roles used for authorization. These roles are used directly instead of extracting from the fern token.
     * This enables static rendering by encoding roles in the URL path.
     * The roles should always include "everyone" for unauthenticated access.
     *
     * For docs page routes, this should always be provided. API routes that need token-based auth
     * should not pass this option and instead rely on the fern_token parameter.
     */
    roles?: string[];
    /**
     * Whether the user is logged in. This is determined by the middleware based on auth state.
     * Used to properly show/hide login button and handle auth-required sites without roles.
     */
    isLoggedIn?: boolean;
    /**
     * Whether the site requires authentication (login). This is determined by the middleware based on
     * whether auth config exists for the site. Used to handle the edge case where a site
     * requires auth but has no roles defined for any pages.
     */
    requiresLogin?: boolean;
};

export type CachedDocsLoader = DocsLoader & {
    clearKvCache: () => Promise<void>;
    isAskAiEnabledForDocs: () => Promise<boolean>;
    /**
     * Fetches files directly from FDR, bypassing the KV cache.
     * Used as a fallback when the cached files are stale or missing file IDs
     * that are referenced in the page markdown.
     */
    getFilesUncached?: () => Promise<Record<string, FileData>>;
};

/**
 * The "use cache" tags help us speed up rendering specific parts of the page that are static.
 * It has a hard-limit of 2MB which is why we cannot use it to cache the entire response.
 * The expectation is that moving forward, we'll update the underlying API to be more cache-friendly
 * in a piece-meal fashion, and eventually remove all use of loadWithUrl.
 */
const createCachedDocsLoaderImpl = async (
    host: string,
    rawDomainKey: string,
    fern_token?: string,
    options?: DocsLoaderOptions
): Promise<CachedDocsLoader> => {
    // Normalize: middleware encodes basepath domains as "domain.com%2Frepo1" in the URL,
    // and Next.js may or may not decode %2F in route params depending on context.
    // Decoding here ensures KV cache keys are always consistent (e.g. "domain.com/repo1").
    const domainKey = decodeURIComponent(rawDomainKey);
    assertDocsDomain(domainKey);

    const config = { ...DEFAULT_CACHE_CONFIG, ...options?.cacheConfig };

    // Force revalidation if requested - only clear KV cache here
    if (config.forceRevalidate) {
        await clearKvCache(domainKey);
    }

    const prefetchPromise = batchGetCommonMetadata(domainKey, config);

    const pureDomain = deriveDomainFromS3Path(domainKey);
    const authConfig = options?.skipAuth ? Promise.resolve(undefined) : getAuthConfig(pureDomain);
    const metadata = getMetadata(config)(withoutStaging(domainKey));

    // Extract options to local variables for proper TypeScript narrowing
    const rolesFromOptions = options?.roles;
    const isLoggedInFromOptions = options?.isLoggedIn;
    const requiresLoginFromOptions = options?.requiresLogin;

    const getAuthState = options?.skipAuth
        ? async (_pathname?: string) => ({
              authed: true as const,
              ok: true as const,
              user: {},
              partner: "custom" as const
          })
        : rolesFromOptions != null
          ? async (_pathname?: string) => {
                const authed = isLoggedInFromOptions ?? false;
                if (authed) {
                    return {
                        authed: true as const,
                        ok: true as const,
                        user: { roles: rolesFromOptions },
                        partner: "custom" as const
                    } as const;
                }

                // User is not logged in - check if we need to get authorizationUrl for login button
                // Note: We call createGetAuthState even if resolvedAuthConfig is null because
                // preview domains may have org-based auth via "authed-previews" config, which is
                // handled separately from domain-based auth config in createGetAuthState
                if (requiresLoginFromOptions) {
                    const resolvedAuthConfig = await authConfig;
                    const resolvedMetadata = await metadata;
                    const basepath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
                    const { getAuthState: originalGetAuthState } = await createGetAuthState(
                        host,
                        domainKey,
                        fern_token,
                        resolvedAuthConfig,
                        resolvedMetadata.isPreview ? { org: resolvedMetadata.org, isPreview: true } : undefined,
                        undefined,
                        basepath
                    );
                    return await originalGetAuthState(_pathname);
                }

                return {
                    authed: false as const,
                    ok: true as const,
                    authorizationUrl: undefined,
                    partner: undefined
                } as const;
            }
          : cache(async (pathname?: string) => {
                const basepath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
                const { getAuthState } = await createGetAuthState(
                    host,
                    domainKey,
                    fern_token,
                    await authConfig,
                    await metadata,
                    undefined,
                    basepath
                );
                return await getAuthState(pathname);
            });

    const getPrunedApiWithSnippets = async (id: string, ...nodes: PruningNodeType[]) => {
        const pruned = await createGetPrunedApiCached(domainKey, config)(id, ...nodes);
        const m = await metadata;
        const dynamicIr = await getDynamicIr(config)(m.org, m.domain, id);
        const settings = await getSettings(config)(domainKey);
        const flags = {
            httpSnippets: settings.httpSnippets !== false ? settings.httpSnippets : false,
            alwaysEnableJavaScriptFetch: settings.useJavascriptAsTypescript
        };
        return backfillSnippets(pruned, dynamicIr, flags);
    };

    return {
        domain: deriveDomainFromS3Path(domainKey),
        fern_token,
        getAuthConfig: () => authConfig,
        getMetadata: async () => {
            const prefetched = await prefetchPromise;
            return prefetched.metadata ?? (await metadata);
        },
        getFiles: async () => {
            const prefetched = await prefetchPromise;
            return prefetched.files ?? (await getFiles(config)(domainKey));
        },
        getMdxBundlerFiles: async () => {
            const edgeFlags = await cachedGetEdgeFlags(domainKey);
            if (!edgeFlags.isCustomReactEnabled) {
                return {};
            }
            const prefetched = await prefetchPromise;
            return prefetched.mdxBundlerFiles ?? (await getMdxBundlerFiles(config)(domainKey));
        },
        getPrunedApi: cache((id: string, ...nodes: PruningNodeType[]) => getPrunedApiWithSnippets(id, ...nodes)),
        getEndpointById: cache((apiDefinitionId: string, endpointId: EndpointId) =>
            getEndpointById({
                domainKey,
                apiDefinitionId,
                endpointId,
                cacheConfig: config
            })
        ),
        getEndpointByLocator: cache(async (method: HttpMethod, path: string, example?: string, apiName?: string) => {
            const cachedGetEndpoint = unstable_cache(
                (method: HttpMethod, path: string, example?: string, apiName?: string) =>
                    getEndpointByLocator(config)(domainKey, method, path, example, apiName),
                [domainKey, config.cacheKeySuffix],
                { tags: [domainKey, "endpointByLocator"] }
            );
            const { apiDefinitionId, endpointId, slugs } = await cachedGetEndpoint(method, path, example, apiName);
            const api = await getPrunedApiWithSnippets(apiDefinitionId, { type: "endpoint", endpointId });
            const endpoint = api.endpoints[endpointId];
            if (endpoint == null) {
                throw new Error(
                    `[getEndpointByLocator] Could not find endpoint ${method} ${path} after backfilling snippets`
                );
            }
            return { apiDefinitionId, endpoint, slugs };
        }),
        getWebhookByLocator: cache(
            unstable_cache(
                (webhookId: string) => getWebhookByLocator(domainKey, webhookId),
                [domainKey, config.cacheKeySuffix],
                { tags: [domainKey, "webhookByLocator"] }
            )
        ),
        getRoot: async () => {
            return getRootCached(config)(domainKey, await getAuthState(), await authConfig);
        },
        getNavigationNode: async (id: string) => {
            return getNavigationNode(config)(domainKey, id, await getAuthState(), await authConfig);
        },
        unsafe_getFullRoot: async () => {
            const prefetched = await prefetchPromise;
            return prefetched.root ?? (await unsafe_getRootCached(config)(domainKey));
        },
        getConfig: async () => {
            const prefetched = await prefetchPromise;
            if (prefetched.config != null) {
                if (!isLocal()) {
                    const cacheKey = config.cacheKeySuffix
                        ? `${domainKey}:config:${config.cacheKeySuffix}`
                        : `${domainKey}:config`;
                    setInMemoryCache(cacheKey, prefetched.config);
                }
                return prefetched.config;
            }
            return await getConfig(config)(domainKey);
        },
        getPage: (pageId) => getPage(config)(domainKey, pageId, options?.returnRawMarkdown),
        getColors: async () => {
            const prefetched = await prefetchPromise;
            return prefetched.colors ?? (await getColors(config)(domainKey));
        },
        getLogoUrls: async () => {
            const prefetched = await prefetchPromise;
            return prefetched.logoUrls ?? (await getLogoUrls(config)(domainKey));
        },
        getLayout: () => getLayout(config)(domainKey),
        getSettings: () => getSettings(config)(domainKey),
        getTheme: () => getTheme(config)(domainKey),
        getLanguage: () => getLanguage(config)(domainKey),
        getFonts: async () => {
            const prefetched = await prefetchPromise;
            return prefetched.fonts ?? (await getFonts(config)(domainKey));
        },
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
        getTypes: (apiName?: string) => getTypes()(domainKey, apiName),
        clearKvCache: () => clearKvCache(domainKey),
        isAskAiEnabledForDocs: async () => {
            const prefetched = await prefetchPromise;
            // Use pureDomain (without basepath) since ask_ai_enabled is a domain-level setting,
            // not basepath-specific. This ensures all basepaths (e.g. /nemo, /nemo/rl) share
            // the same cache entry and return the same result as the root domain.
            return prefetched.askAiEnabled ?? (await getAskAiEnabledForDocs(config)(pureDomain));
        },
        getDocsStatus: async () => {
            const m = await metadata;
            const pureDomainForStatus = deriveDomainFromS3Path(domainKey);
            return getDocsDeploymentStatus(config)(pureDomainForStatus, m.basePath || undefined);
        },
        getFilesUncached: async () => {
            // Fetch files directly from FDR, bypassing KV cache entirely.
            // This is used as a fallback when cached files are missing IDs referenced in page markdown.
            // Use domain with basepath (if any) so S3 loads from the correct folder.
            const { domain: domainForS3 } = decodeDocsLoaderDomainKey(domainKey);
            try {
                const response = await uncachedLoadWithUrl(domainForS3);
                return mapValues(response.definition.filesV2, (file) => {
                    if (file == null) {
                        return { src: "" };
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
                    throw new UnreachableCaseError(file);
                });
            } catch (error) {
                logger.error(`[getFilesUncached] Failed to load files for ${domainForS3}`, error);
                track("asset_error", {
                    type: "get_files_uncached_error",
                    domain: domainForS3,
                    error: String(error)
                });
                return {};
            }
        }
    };
};

/**
 * Request-level memoized version of createCachedDocsLoader.
 * This ensures that all parallel routes within a single request share the same loader instance,
 * dramatically reducing duplicate Upstash KV calls.
 *
 * In docs dev mode, we bypass the cache() wrapper to prevent memoizing rejected promises
 * when the backend is not ready. This allows the docs dev server to recover when the
 * backend becomes available.
 */
export const createCachedDocsLoader = isDocsDev() ? createCachedDocsLoaderImpl : cache(createCachedDocsLoaderImpl);

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
        case "graphql":
            return {
                type: "graphql",
                graphqlOperationId: node.graphqlOperationId
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
