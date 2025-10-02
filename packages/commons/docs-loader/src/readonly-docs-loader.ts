import { unstable_cache, unstable_cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { kv } from "@vercel/kv";
import { createHash } from "crypto";
import { Semaphore, mapValues } from "es-toolkit";
import { type AsyncOrSync, UnreachableCaseError } from "ts-essentials";

import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import { track } from "@fern-api/docs-server";
import {
  type AuthState,
  type FernFonts,
  cacheSeed,
  cleanBasePath,
  createGetAuthState,
  findEndpoint,
  generateFernColorPalette,
  generateFonts,
  getDocsUrlMetadata,
  isLocal,
  isSelfHosted,
  provideRegistryService,
  pruneWithAuthState,
} from "@fern-api/docs-server";
import {
  loadWithUrl as cachedLoadWithUrl,
  loadDynamicIRWithUrl as uncachedLoadDynamicIRWithUrl,
  uncachedLoadWithUrl,
} from "@fern-api/docs-server";
import {
  type DocsLoader,
  type DocsMetadata,
  DocsMetadataSchema,
} from "@fern-api/docs-server/docs-loader";
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
  withoutStaging,
} from "@fern-api/docs-utils";
import type { HttpMethod } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernAIClient } from "@fern-api/fai-sdk";
import {
  type ApiDefinition,
  type DocsV1Read,
  type DocsV2Read,
  FernNavigation,
} from "@fern-api/fdr-sdk";
import {
  ApiDefinitionV1ToLatest,
  type AuthScheme,
  type EnvironmentId,
  type ObjectProperty,
  type PruningNodeType,
  type TypeDefinition,
  backfillSnippets,
  prune,
} from "@fern-api/fdr-sdk/api-definition";
import {
  ApiDefinitionId,
  EndpointId,
  type PageId,
  type Slug,
  type TypeId,
} from "@fern-api/fdr-sdk/navigation";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish, isPlainObject } from "@fern-api/ui-core-utils";
import { visualEditorStorage } from "@fern-api/visual-editor-server";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";

const loadWithUrl = async (
  domainKey: string
): Promise<DocsV2Read.LoadDocsForUrlResponse> => {
  const { domain, branchName } = decodeDocsLoaderDomainKey(domainKey);
  if (branchName) {
    try {
      const associatedBranchFdr = await visualEditorStorage.getFdrSnapshot(
        domain,
        branchName
      );
      if (associatedBranchFdr) {
        return associatedBranchFdr;
      }
    } catch (error) {
      console.warn(
        `Failed to get FDR snapshot for ${domain}:${branchName}, fallback to uncached`,
        error
      );
    }
  }
  if (branchName) {
    const response = await uncachedLoadWithUrl(domain);
    await visualEditorStorage.storeFdrSnapshot(domain, branchName, response);
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
  cacheKeySuffix: "",
};

function assertDocsDomain(domainKey: string) {
  const domain = deriveDomainFromDomainKey(domainKey);
  if (FERN_DOCS_ORIGINS.includes(domain) || domain.endsWith(".vercel.app")) {
    console.error(`[assertDocsDomain:${domain}] Found unexpected domain`);
    notFound();
  }
}

const setMonitor = new Semaphore(10);

function kvSet(
  domainKey: string,
  key: string,
  value: unknown,
  ttl?: number,
  cacheKeySuffix?: string
) {
  if (isLocal() || isSelfHosted()) {
    return;
  }

  const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;

  console.log(
    `[Upstash] SET operation - domain: ${domainKey}, key: ${finalKey}, ttl: ${ttl || "none"}`
  );

  after(async () => {
    await setMonitor.acquire();
    const start = Date.now();
    try {
      if (ttl && ttl > 0) {
        await kv.hset(domainKey, { [finalKey]: value });
        // Set expiration for the hash field (note: Redis doesn't support per-field TTL in hashes)
        // So we'll use a separate key for TTL tracking
        await kv.setex(
          `${domainKey}:ttl:${finalKey}`,
          ttl,
          Date.now() + ttl * 1000
        );
      } else {
        await kv.hset(domainKey, { [finalKey]: value });
      }
      const duration = Date.now() - start;
      console.log(
        `[Upstash] SET completed - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
      );

      track("upstash_cache_set", {
        domain: domainKey,
        cacheKey: finalKey,
        hasTtl: Boolean(ttl && ttl > 0),
        ttl: ttl,
        duration,
      });
    } catch (error) {
      console.warn(
        `[Upstash] SET failed - domain: ${domainKey}, key: ${finalKey}`,
        error
      );
      track("upstash_cache_set_error", {
        domain: domainKey,
        cacheKey: finalKey,
        error: String(error),
      });
    } finally {
      setMonitor.release();
    }
  });
}

const getMonitor = new Semaphore(10);

// Deduplicate simultaneous requests for the same key
const inFlightRequests = new Map<string, Promise<any>>();

async function kvGet<T>(
  domainKey: string,
  key: string,
  cacheKeySuffix?: string
): Promise<T | null> {
  if (isLocal() || isSelfHosted()) {
    return null;
  }

  const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;
  const requestKey = `${domainKey}:${finalKey}`;

  // If there's already an in-flight request, wait for it
  if (inFlightRequests.has(requestKey)) {
    console.log(
      `[Upstash] Waiting for in-flight request - domain: ${domainKey}, key: ${finalKey}`
    );
    return inFlightRequests.get(requestKey) as Promise<T | null>;
  }

  console.log(
    `[Upstash] GET operation - domain: ${domainKey}, key: ${finalKey}`
  );

  // Create the request promise
  const requestPromise = (async () => {
    await getMonitor.acquire();
    const start = Date.now();
    try {
      // Check if the key has expired
      const ttlKey = `${domainKey}:ttl:${finalKey}`;
      const expiration = await kv.get<number>(ttlKey);

      if (expiration && Date.now() > expiration) {
        // Key has expired, delete it
        await kv.hdel(domainKey, finalKey);
        await kv.del(ttlKey);
        const duration = Date.now() - start;
        console.log(
          `[Upstash] GET expired - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
        );

        track("upstash_cache_get", {
          domain: domainKey,
          cacheKey: finalKey,
          hit: false,
          expired: true,
          duration,
        });
        return null;
      }

      const result = await kv.hget<T>(domainKey, finalKey);
      const duration = Date.now() - start;
      const isHit = result != null;

      console.log(
        `[Upstash] GET ${isHit ? "hit" : "miss"} - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
      );

      track("upstash_cache_get", {
        domain: domainKey,
        cacheKey: finalKey,
        hit: isHit,
        expired: false,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.warn(
        `[Upstash] GET failed - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`,
        error
      );

      track("upstash_cache_get_error", {
        domain: domainKey,
        cacheKey: finalKey,
        error: String(error),
        duration,
      });
      return null;
    } finally {
      getMonitor.release();
    }
  })();

  // Store the promise and remove it when done
  inFlightRequests.set(requestKey, requestPromise);
  requestPromise
    .finally(() => {
      inFlightRequests.delete(requestKey);
    })
    .catch(() => {
      // Errors are already handled in the main promise, this is just for cleanup
    });

  return requestPromise;
}

// In-memory cache for config to reduce Upstash calls
interface InMemoryCacheEntry<T> {
  value: T;
  timestamp: number;
}

const IN_MEMORY_CONFIG_CACHE = new Map<
  string,
  InMemoryCacheEntry<
    Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">
  >
>();
const IN_MEMORY_CACHE_TTL_MS = 60_000; // 60 seconds

function getFromInMemoryCache<T>(
  key: string
): InMemoryCacheEntry<T>["value"] | null {
  const entry = IN_MEMORY_CONFIG_CACHE.get(key) as
    | InMemoryCacheEntry<T>
    | undefined;
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
    timestamp: Date.now(),
  } as InMemoryCacheEntry<any>);
}

async function clearKvCache(domainKey: string) {
  // Clear in-memory cache entries for this domain
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
    console.log(
      `In-memory cache cleared for domainKey: ${domainKey} (${keysToDelete.length} entries)`
    );
  }

  if (isLocal() || isSelfHosted()) {
    return;
  }

  try {
    // Clear KV cache for domainKey
    const keys = await kv.hkeys(domainKey);
    if (keys.length > 0) {
      await kv.hdel(domainKey, ...keys);
    }

    // Clear TTL tracking keys
    const ttlKeys = await kv.keys(`${domainKey}:ttl:*`);
    if (ttlKeys.length > 0) {
      await kv.del(...ttlKeys);
    }

    console.log(`KV cache cleared for domainKey: ${domainKey}`);
  } catch (error) {
    console.error(
      `Failed to clear KV cache for domainKey ${domainKey}:`,
      error
    );
  }
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
    getDocsUrlMetadata(deriveDomainFromDomainKey(domainKey)),
  ]);

  return {
    domain: response.baseUrl.domain,
    basePath: cleanBasePath(response.baseUrl.basePath),
    url: docsUrlMetadata.url,
    org: docsUrlMetadata.org,
    isPreview: docsUrlMetadata.isPreview,
  };
};

export const getMetadata = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domainKey: string): Promise<DocsMetadata> => {
    "use cache";
    unstable_cacheTag(domainKey, "getMetadata");
    assertDocsDomain(domainKey);

    try {
      const cached = DocsMetadataSchema.safeParse(
        await kvGet<DocsMetadata>(
          domainKey,
          "metadata",
          cacheConfig.cacheKeySuffix
        )
      );
      if (cached.success) {
        console.log("[getMetadata] cache hit:", cached.data);
        return cached.data;
      }
    } catch (error) {
      console.warn(
        `Failed to get metadata for ${domainKey} from kv, fallback to uncached`,
        error
      );
    }

    const metadata = await getMetadataFromResponse(
      domainKey,
      loadWithUrl(domainKey)
    );
    kvSet(
      domainKey,
      "metadata",
      metadata,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    console.log("[getMetadata] cache miss:", metadata);
    return metadata;
  });

const getFiles = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string): Promise<Record<string, FileData>> => {
    "use cache";
    unstable_cacheTag(domain, "getFiles");

    try {
      const cached = await kvGet<Record<string, FileData>>(
        domain,
        "files",
        cacheConfig.cacheKeySuffix
      );
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get files for ${domain}, fallback to uncached`,
        error
      );
    }
    const response = await loadWithUrl(domain);
    const files = mapValues(response.definition.filesV2, (file) => {
      if (file.type === "url") {
        return {
          src:
            process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
              ? file.url.replace(
                  getFileCDN(),
                  `${response.baseUrl.basePath ?? ""}/_files`
                )
              : file.url,
        };
      } else if (file.type === "image") {
        return {
          src:
            process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
              ? file.url.replace(
                  getFileCDN(),
                  `${response.baseUrl.basePath ?? ""}/_files`
                )
              : file.url,
          width: file.width,
          height: file.height,
          blurDataURL: file.blurDataUrl,
          alt: file.alt,
        };
      }
      throw new UnreachableCaseError(file);
    });

    kvSet(
      domain,
      "files",
      files,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
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
    const response = await provideRegistryService().api.v1.read.getApi(
      ApiDefinitionId(id)
    );
    if (response.ok) {
      v1 = response.body;
    } else {
      console.error("Could not get API with ID", ApiDefinitionId(id));
      notFound();
    }
  }
  const flags = await cachedGetEdgeFlags(domainKey);
  return ApiDefinitionV1ToLatest.from(v1, flags).migrate();
};

const createGetPrunedApiCached = (
  domainKey: string,
  cacheConfig: Required<CacheConfig>
) =>
  unstable_cache(
    async (
      id: string,
      ...nodes: PruningNodeType[]
    ): Promise<ApiDefinition.ApiDefinition> => {
      const flagsPromise = cachedGetEdgeFlags(domainKey);
      // if there is only one node, and it's an endpoint, try to load from cache
      try {
        if (nodes.length === 1 && nodes[0]) {
          const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
          const cached = await kvGet<ApiDefinition.ApiDefinition>(
            domainKey,
            key,
            cacheConfig.cacheKeySuffix
          );
          if (cached != null) {
            const metadata = await getMetadata(cacheConfig)(domainKey);
            const dynamicIr = await getDynamicIr(id)(
              metadata.org,
              metadata.domain
            );
            return await backfillSnippets(
              cached,
              dynamicIr,
              await flagsPromise
            );
          }
        }
      } catch (error) {
        console.warn(
          `Failed to get pruned api for ${domainKey}:${id}, fallback to uncached`,
          error
        );
      }

      const api = await getApi(domainKey, id);
      const pruned = prune(api, ...nodes);
      for (const endpointK of Object.keys(pruned.endpoints)) {
        if (
          pruned.endpoints[EndpointId(endpointK)]?.environments?.length === 0
        ) {
          console.debug(
            `${endpointK} has empty environments, adding default URL.`
          );
          pruned.endpoints[EndpointId(endpointK)]?.environments?.push({
            id: "Default" as EnvironmentId,
            baseUrl: "https://host.com",
          });
        }
      }
      // if there is only one node, and it's an endpoint, try to cache the result
      if (nodes.length === 1 && nodes[0]) {
        const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
        kvSet(
          domainKey,
          key,
          pruned,
          cacheConfig.kvTtl,
          cacheConfig.cacheKeySuffix
        );
      }
      const metadata = await getMetadata(cacheConfig)(domainKey);
      const dynamicIr = await getDynamicIr(id)(metadata.org, metadata.domain);
      return backfillSnippets(pruned, dynamicIr, await flagsPromise);
    },
    [domainKey, cacheSeed(), cacheConfig.cacheKeySuffix],
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

const getAllApisForDomain = async (
  domainKey: string
): Promise<ApiDefinition.ApiDefinition[]> => {
  const response = await loadWithUrl(domainKey);
  if (
    response.definition.apisV2 &&
    Object.keys(response.definition.apisV2).length > 0
  ) {
    return Object.values(response.definition.apisV2);
  }
  const flags = await cachedGetEdgeFlags(domainKey);
  return Object.values(response.definition.apis).map((v1) =>
    ApiDefinitionV1ToLatest.from(v1, flags).migrate()
  );
};

const getEndpointById = async ({
  domainKey,
  apiDefinitionId,
  endpointId,
  cacheConfig,
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

  const api = await createGetPrunedApiCached(domainKey, cacheConfig)(
    apiDefinitionId,
    {
      type: "endpoint",
      endpointId,
    }
  );

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
          node.type === "endpoint" &&
          node.apiDefinitionId === api.id &&
          node.endpointId === endpoint.id
      ),
    globalHeaders: api.globalHeaders ?? [],
    authSchemes:
      endpoint.auth?.map((id) => api.auths[id]).filter(isNonNullish) ?? [],
    types: api.types,
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
  const apis = await getAllApisForDomain(domainKey);
  for (const api of apis) {
    const endpoint = findEndpoint({
      apiDefinition: api,
      method,
      path,
      example,
    });
    if (endpoint != null) {
      const root = await unsafe_getFullRoot(domainKey);
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
        endpoint,
        slugs,
      };
    }
  }
  console.error(`Could not find endpoint ${method} ${path}`);
  notFound();
};

export function convertResponseToRootNode(
  response: DocsV2Read.LoadDocsForUrlResponse,
  edgeFlags: EdgeFlags
) {
  let root: FernNavigation.RootNode | undefined;
  if (response.definition.config.root) {
    root = FernNavigation.migrate.FernNavigationV1ToLatest.create().root(
      response.definition.config.root
    );
  } else if (response.definition.config.navigation) {
    root = FernNavigation.utils.toRootNode(
      response,
      edgeFlags.isBatchStreamToggleDisabled,
      edgeFlags.isApiScrollingDisabled
    );
  }

  if (root && edgeFlags.isApiScrollingDisabled) {
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
    const cached = await kvGet<FernNavigation.RootNode>(domainKey, "root");
    if (cached != null) {
      return cached;
    }
  } catch (error) {
    console.warn(
      `Failed to get full root for ${domainKey}, fallback to uncached`,
      error
    );
  }
  const response = await loadWithUrl(domainKey);
  const root = convertResponseToRootNode(
    response,
    await cachedGetEdgeFlags(domainKey)
  );
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
            "root",
            cacheConfig.cacheKeySuffix
          );
          if (cached != null) {
            return cached;
          }
        } catch (error) {
          console.warn(
            `Failed to get full root for ${domainKey}, fallback to uncached`,
            error
          );
        }

        // Get fresh data
        const root = await unsafe_getFullRoot(domainKey);

        // Cache the result
        kvSet(
          domainKey,
          "root",
          root,
          cacheConfig.kvTtl,
          cacheConfig.cacheKeySuffix
        );

        return root;
      },
      ["unsafe_getRoot", cacheSeed(), cacheConfig.cacheKeySuffix],
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
  cache(
    async (
      domainKey: string,
      authState: AuthState,
      authConfig: AuthEdgeConfig | undefined
    ) => {
      return await unstable_cache(
        (
          domainKey: string,
          authState: AuthState,
          authConfig: AuthEdgeConfig | undefined
        ) => getRoot(domainKey, authState, authConfig, cacheConfig),
        [domainKey, cacheSeed(), cacheConfig.cacheKeySuffix],
        { tags: [domainKey, "getRoot"] }
      )(domainKey, authState, authConfig);
    }
  );

const getNavigationNode = (cacheConfig: Required<CacheConfig>) =>
  cache(
    async (
      domainKey: string,
      id: string,
      authState: AuthState,
      authConfig: AuthEdgeConfig | undefined
    ) => {
      const root = await getRootCached(cacheConfig)(
        domainKey,
        authState,
        authConfig
      );
      const collector = FernNavigation.NodeCollector.collect(root);
      const node = collector.get(FernNavigation.NodeId(id));
      if (node == null) {
        console.error(`Could not find node ${id} for domainKey ${domainKey}`);
        notFound();
      }
      return node;
    }
  );

const getConfig = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domainKey: string) => {
    // Check in-memory cache first
    const cacheKey = cacheConfig.cacheKeySuffix
      ? `${domainKey}:config:${cacheConfig.cacheKeySuffix}`
      : `${domainKey}:config`;
    const inMemoryCached =
      getFromInMemoryCache<
        Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">
      >(cacheKey);
    if (inMemoryCached != null) {
      console.log(`[getConfig] in-memory cache hit for ${domainKey}`);
      return inMemoryCached;
    }

    try {
      const cached = await kvGet<
        Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">
      >(domainKey, "config", cacheConfig.cacheKeySuffix);
      if (cached != null) {
        // Store in in-memory cache for future requests
        setInMemoryCache(cacheKey, cached);
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get config for ${domainKey}, fallback to uncached`,
        error
      );
    }

    const response = await loadWithUrl(domainKey);
    const { navigation, root, ...config } = response.definition.config;

    // Store in both Upstash and in-memory cache
    kvSet(
      domainKey,
      "config",
      config,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    setInMemoryCache(cacheKey, config);

    return config;
  });

const getPage = (cacheConfig: Required<CacheConfig>) =>
  cache(
    async (
      domainKey: string,
      pageId: string,
      returnRawMarkdown: boolean = false
    ) => {
      try {
        const page = await kvGet<DocsV1Read.PageContent>(
          domainKey,
          `page:${pageId}`,
          cacheConfig.cacheKeySuffix
        );
        if (page != null && isPlainObject(page) && "markdown" in page) {
          const config = await getConfig(cacheConfig)(domainKey);
          return {
            filename: pageId,
            markdown: page.markdown,
            editThisPageUrl: page.editThisPageUrl,
            css: config.css,
            rawMarkdown: returnRawMarkdown ? page.rawMarkdown : undefined,
          };
        }
      } catch (error) {
        console.warn(
          `Failed to get page for ${domainKey}:${pageId}, fallback to uncached`,
          error
        );
      }

      const response = await loadWithUrl(domainKey);
      const page = response.definition.pages[pageId as PageId];
      if (page == null) {
        console.error(`Could not find page with ID ${pageId}`);
        notFound();
      }

      kvSet(
        domainKey,
        `page:${pageId}`,
        page,
        cacheConfig.kvTtl,
        cacheConfig.cacheKeySuffix
      );
      return {
        filename: pageId,
        markdown: page.markdown,
        editThisPageUrl: page.editThisPageUrl,
        css: response.definition.config.css,
        rawMarkdown: returnRawMarkdown ? page.rawMarkdown : undefined,
      };
    }
  );

const getMdxBundlerFiles = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domainKey: string) => {
    "use cache";
    unstable_cacheTag(domainKey, "getMdxBundlerFiles");

    try {
      const cached = await kvGet<Record<string, string>>(
        domainKey,
        "mdx-bundler-files",
        cacheConfig.cacheKeySuffix
      );
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get mdx bundler files for ${domainKey}, fallback to uncached`,
        error
      );
    }

    const response = await loadWithUrl(domainKey);
    const files = response.definition.jsFiles ?? {};
    kvSet(
      domainKey,
      "mdx-bundler-files",
      files,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
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
      }>(domainKey, "colors", cacheConfig.cacheKeySuffix);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get colors for ${domainKey}, fallback to uncached`,
        error
      );
    }

    const [config, files] = await Promise.all([
      getConfig(cacheConfig)(domainKey),
      getFiles(cacheConfig)(domainKey),
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
            backgroundImage: light.backgroundImage
              ? files[light.backgroundImage]
              : undefined,
            ...generateFernColorPalette({
              appearance: "light",
              background: toOklch(light.background),
              accent: toOklch(light.accentPrimary),
              border: toOklch(light.border),
              sidebarBackground: toOklch(light.sidebarBackground),
              headerBackground: toOklch(light.headerBackground),
              cardBackground: toOklch(light.cardBackground),
            }),
            backgroundGradient: light.background.type === "gradient",
          }
        : undefined,
      dark: dark
        ? {
            logo: dark.logo ? files[dark.logo] : undefined,
            backgroundImage: dark.backgroundImage
              ? files[dark.backgroundImage]
              : undefined,
            ...generateFernColorPalette({
              appearance: "dark",
              background: toOklch(dark.background),
              accent: toOklch(dark.accentPrimary),
              border: toOklch(dark.border),
              sidebarBackground: toOklch(dark.sidebarBackground),
              headerBackground: toOklch(dark.headerBackground),
              cardBackground: toOklch(dark.cardBackground),
            }),
            backgroundGradient: dark.background.type === "gradient",
          }
        : undefined,
    };

    kvSet(
      domainKey,
      "colors",
      colors,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    return colors;
  });

const getFonts = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domainKey: string) => {
    "use cache";
    unstable_cacheTag(domainKey, "getFonts");

    try {
      const cached = await kvGet<FernFonts>(
        domainKey,
        "fonts",
        cacheConfig.cacheKeySuffix
      );
      if (cached != null) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get fonts for ${domainKey}, fallback to uncached`,
        error
      );
    }

    const response = await loadWithUrl(domainKey);
    const fonts = generateFonts(
      response.definition.config.typographyV2,
      await getFiles(cacheConfig)(domainKey)
    );
    kvSet(
      domainKey,
      "fonts",
      fonts,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
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
    const sidebarWidth =
      toPx(config.layout?.sidebarWidth) ?? DEFAULT_SIDEBAR_WIDTH;
    const contentWidth =
      toPx(config.layout?.contentWidth) ?? DEFAULT_CONTENT_WIDTH;
    const pageWidth =
      config.layout?.pageWidth?.type === "full"
        ? undefined
        : (toPx(config.layout?.pageWidth) ??
          calcDefaultPageWidth(sidebarWidth, contentWidth));
    const headerHeight =
      toPx(config.layout?.headerHeight) ?? DEFAULT_HEADER_HEIGHT;
    const tabsPlacement = config.layout?.disableHeader
      ? "SIDEBAR"
      : (config.layout?.tabsPlacement ?? defaultTabsPlacement(domainKey));
    const searchbarPlacement = config.layout?.disableHeader
      ? "SIDEBAR"
      : (config.layout?.searchbarPlacement ??
        defaultSearchbarPlacement(domainKey));

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
      hideFeedback: config.layout?.hideFeedback ?? false,
    };
  });

const getDynamicIr = (apiName: string) =>
  cache(async (orgId: string, domain: string) => {
    "use cache";
    const api = await getApi(domain, apiName);

    const configHash = api.snippetsConfiguration
      ? createHash("sha256")
          .update(JSON.stringify(api.snippetsConfiguration))
          .digest("hex")
          .slice(0, 16)
      : "no-config";

    unstable_cacheTag(
      `getDynamicIr:org:${orgId}`,
      `getDynamicIr:api:${apiName}`,
      `getDynamicIr:config:${configHash}`
    );

    const response = await loadDynamicIRWithUrl({
      orgId,
      apiName,
      snippetsConfig: api.snippetsConfiguration,
    });

    if (response) {
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
  return Math.max(
    DEFAULT_PAGE_WIDTH,
    sidebarWidth * 2 + contentWidth + DEFAULT_GUTTER_WIDTH
  );
}

const getAuthConfig = getAuthEdgeConfig;

const getAskAiEnabled = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string) => {
    "use cache";
    unstable_cacheTag(`${domain}_askAiEnabled`);

    if (isLocal() || isSelfHosted()) {
      return false;
    }

    try {
      const cached = await kvGet<boolean>(
        domain,
        "askAiEnabled",
        cacheConfig.cacheKeySuffix
      );
      if (cached != null) {
        console.log("[getAskAiEnabled] cache hit:", cached);
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get askAiEnabled for ${domain}, fallback to uncached`,
        error
      );
    }

    let result = false;
    try {
      result = (
        await new FernAIClient({
          baseUrl:
            process.env.FAI_SERVER_URL ?? "https://fai.buildwithfern.com",
          token: process.env.FERN_TOKEN ?? "",
        }).settings.getSettings({ domain })
      ).ask_ai_enabled;

      kvSet(
        domain,
        "askAiEnabled",
        result,
        cacheConfig.kvTtl,
        cacheConfig.cacheKeySuffix
      );
    } catch (error) {
      console.warn(`Failed to fetch askAiEnabled for ${domain}`, error);
    }
    return result;
  });

export type DocsLoaderOptions = {
  cacheConfig?: CacheConfig;
  skipAuth?: boolean;
  returnRawMarkdown?: boolean;
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
): Promise<
  DocsLoader & {
    clearKvCache: () => Promise<void>;
    isAskAiEnabled: () => Promise<boolean>;
  }
> => {
  assertDocsDomain(domainKey);

  const config = { ...DEFAULT_CACHE_CONFIG, ...options?.cacheConfig };

  // Force revalidation if requested - only clear KV cache here
  if (config.forceRevalidate) {
    await clearKvCache(domainKey);
  }

  const authConfig = options?.skipAuth
    ? Promise.resolve(undefined)
    : getAuthConfig(domainKey);
  const metadata = getMetadata(config)(withoutStaging(domainKey));

  const getAuthState = options?.skipAuth
    ? async (_pathname?: string) => ({
        authed: true as const,
        ok: true as const,
        user: {},
        partner: "custom" as const,
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
        cacheConfig: config,
      })
    ),
    getEndpointByLocator: cache(
      unstable_cache(
        (method: HttpMethod, path: string, example?: string) =>
          getEndpointByLocator(domainKey, method, path, example),
        [domainKey, cacheSeed(), config.cacheKeySuffix],
        { tags: [domainKey, "endpointByLocator"] }
      )
    ),
    getRoot: async () =>
      getRootCached(config)(domainKey, await getAuthState(), await authConfig),
    getNavigationNode: async (id: string) =>
      getNavigationNode(config)(
        domainKey,
        id,
        await getAuthState(),
        await authConfig
      ),
    unsafe_getFullRoot: () => unsafe_getRootCached(config)(domainKey),
    getConfig: () => getConfig(config)(domainKey),
    getPage: (pageId) =>
      getPage(config)(domainKey, pageId, options?.returnRawMarkdown),
    getColors: () => getColors(config)(domainKey),
    getLayout: () => getLayout(config)(domainKey),
    getFonts: () => getFonts(config)(domainKey),
    getAuthState,
    getEdgeFlags: () => cachedGetEdgeFlags(domainKey),
    getBaseUrl: async () => {
      const m = await metadata;
      return `https://${m.domain}${m.basePath}`;
    },
    getDynamicIr: async (apiName: string) => {
      const m = await metadata;
      return getDynamicIr(apiName)(m.org, m.domain);
    },
    clearKvCache: () => clearKvCache(domainKey),
    isAskAiEnabled: () => getAskAiEnabled(config)(domainKey),
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
  config:
    | { type: "px"; value: number }
    | { type: "rem"; value: number }
    | undefined
): number | undefined {
  if (!config) {
    return undefined;
  }
  if (config.type === "px") {
    return config.value;
  }
  return config.value * 16;
}

export function createPruneKey(
  node: FernNavigation.NavigationNodeApiLeaf
): PruningNodeType {
  switch (node.type) {
    case "endpoint":
      return {
        type: "endpoint",
        endpointId: node.endpointId,
      };
    case "webSocket":
      return {
        type: "webSocket",
        webSocketId: node.webSocketId,
      };
    case "webhook":
      return {
        type: "webhook",
        webhookId: node.webhookId,
      };
    case "grpc":
      return {
        type: "grpc",
        grpcId: node.grpcId,
      };
    default:
      throw new Error(`Unknown node type: ${node}`);
  }
}

function getFileCDN() {
  return (
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_FILES_ORIGIN
      : undefined) ?? "https://files.buildwithfern.com"
  );
}
