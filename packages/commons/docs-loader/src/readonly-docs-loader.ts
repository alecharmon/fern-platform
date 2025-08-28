import { unstable_cache, unstable_cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { kv } from "@vercel/kv";
import { Semaphore } from "es-toolkit/compat";
import { mapValues } from "es-toolkit/object";
import { type AsyncOrSync, UnreachableCaseError } from "ts-essentials";

import type { AuthEdgeConfig } from "@fern-api/docs-auth";
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
  loadDynamicIRWithUrl as uncachedLoadDynamicIRWithUrl,
  loadWithUrl as uncachedLoadWithUrl,
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
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";

const loadWithUrl = uncachedLoadWithUrl;
const loadDynamicIRWithUrl = uncachedLoadDynamicIRWithUrl;

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

function assertDocsDomain(domain: string) {
  if (FERN_DOCS_ORIGINS.includes(domain) || domain.endsWith(".vercel.app")) {
    console.error(`[assertDocsDomain:${domain}] Found unexpected domain`);
    notFound();
  }
}

const setMonitor = new Semaphore(10);

function kvSet(
  domain: string,
  key: string,
  value: unknown,
  ttl?: number,
  cacheKeySuffix?: string
) {
  if (isLocal() || isSelfHosted()) {
    return;
  }

  const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;

  after(async () => {
    await setMonitor.acquire();
    try {
      if (ttl && ttl > 0) {
        await kv.hset(domain, { [finalKey]: value });
        // Set expiration for the hash field (note: Redis doesn't support per-field TTL in hashes)
        // So we'll use a separate key for TTL tracking
        await kv.setex(
          `${domain}:ttl:${finalKey}`,
          ttl,
          Date.now() + ttl * 1000
        );
      } else {
        await kv.hset(domain, { [finalKey]: value });
      }
    } catch (error) {
      console.warn(`Failed to set kv key ${finalKey}: ${value}`, error);
    } finally {
      setMonitor.release();
    }
  });
}

const getMonitor = new Semaphore(10);

async function kvGet<T>(
  domain: string,
  key: string,
  cacheKeySuffix?: string
): Promise<T | null> {
  if (isLocal() || isSelfHosted()) {
    return null;
  }

  const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;

  await getMonitor.acquire();
  try {
    // Check if the key has expired
    const ttlKey = `${domain}:ttl:${finalKey}`;
    const expiration = await kv.get<number>(ttlKey);

    if (expiration && Date.now() > expiration) {
      // Key has expired, delete it
      await kv.hdel(domain, finalKey);
      await kv.del(ttlKey);
      return null;
    }

    return await kv.hget<T>(domain, finalKey);
  } catch (error) {
    console.warn(`Failed to get kv key ${finalKey}`, error);
    return null;
  } finally {
    getMonitor.release();
  }
}

async function clearKvCache(domain: string) {
  if (isLocal() || isSelfHosted()) {
    return;
  }

  try {
    // Clear KV cache for domain
    const keys = await kv.hkeys(domain);
    if (keys.length > 0) {
      await kv.hdel(domain, ...keys);
    }

    // Clear TTL tracking keys
    const ttlKeys = await kv.keys(`${domain}:ttl:*`);
    if (ttlKeys.length > 0) {
      await kv.del(...ttlKeys);
    }

    console.log(`KV cache cleared for domain: ${domain}`);
  } catch (error) {
    console.error(`Failed to clear KV cache for domain ${domain}:`, error);
  }
}

const cachedGetEdgeFlags = cache(async (domain: string) => {
  if (isLocal()) {
    return DEFAULT_LOCAL_EDGE_FLAGS;
  } else if (isSelfHosted()) {
    return DEFAULT_SELF_HOSTED_EDGE_FLAGS;
  }
  return await getEdgeFlags(domain);
});

export const getMetadataFromResponse = async (
  domain: string,
  responsePromise: AsyncOrSync<DocsV2Read.LoadDocsForUrlResponse>
): Promise<DocsMetadata> => {
  assertDocsDomain(domain);
  const [response, docsUrlMetadata] = await Promise.all([
    responsePromise,
    getDocsUrlMetadata(domain),
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
  cache(async (domain: string): Promise<DocsMetadata> => {
    "use cache";
    unstable_cacheTag(domain, "getMetadata");
    assertDocsDomain(domain);

    try {
      const cached = DocsMetadataSchema.safeParse(
        await kvGet<DocsMetadata>(
          domain,
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
        `Failed to get metadata for ${domain} from kv, fallback to uncached`,
        error
      );
    }

    const metadata = await getMetadataFromResponse(domain, loadWithUrl(domain));
    kvSet(
      domain,
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
const getApi = async (domain: string, id: string) => {
  "use cache";
  unstable_cacheTag(domain, "getApi", id);
  const response = await loadWithUrl(domain);
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
  const flags = await cachedGetEdgeFlags(domain);
  return ApiDefinitionV1ToLatest.from(v1, flags).migrate();
};

const createGetPrunedApiCached = (
  domain: string,
  cacheConfig: Required<CacheConfig>
) =>
  unstable_cache(
    async (
      id: string,
      ...nodes: PruningNodeType[]
    ): Promise<ApiDefinition.ApiDefinition> => {
      const flagsPromise = cachedGetEdgeFlags(domain);
      // if there is only one node, and it's an endpoint, try to load from cache
      try {
        if (nodes.length === 1 && nodes[0]) {
          const key = `api:${id}:${createEndpointCacheKey(nodes[0])}`;
          const cached = await kvGet<ApiDefinition.ApiDefinition>(
            domain,
            key,
            cacheConfig.cacheKeySuffix
          );
          if (cached != null) {
            return await backfillSnippets(cached, await flagsPromise);
          }
        }
      } catch (error) {
        console.warn(
          `Failed to get pruned api for ${domain}:${id}, fallback to uncached`,
          error
        );
      }

      const api = await getApi(domain, id);
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
          domain,
          key,
          pruned,
          cacheConfig.kvTtl,
          cacheConfig.cacheKeySuffix
        );
      }
      return backfillSnippets(pruned, await flagsPromise);
    },
    [domain, cacheSeed(), cacheConfig.cacheKeySuffix],
    { tags: [domain, "api"] }
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
  domain: string
): Promise<ApiDefinition.ApiDefinition[]> => {
  const response = await loadWithUrl(domain);
  if (
    response.definition.apisV2 &&
    Object.keys(response.definition.apisV2).length > 0
  ) {
    return Object.values(response.definition.apisV2);
  }
  const flags = await cachedGetEdgeFlags(domain);
  return Object.values(response.definition.apis).map((v1) =>
    ApiDefinitionV1ToLatest.from(v1, flags).migrate()
  );
};

const getEndpointById = async ({
  domain,
  apiDefinitionId,
  endpointId,
  cacheConfig,
}: {
  domain: string;
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
  unstable_cacheTag(domain, "getEndpointById", apiDefinitionId, endpointId);

  const api = await createGetPrunedApiCached(domain, cacheConfig)(
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

  const root = await unsafe_getFullRoot(domain);
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
  domain: string,
  method: HttpMethod,
  path: string,
  example?: string
): Promise<{
  apiDefinitionId: ApiDefinition.ApiDefinitionId;
  endpoint: ApiDefinition.EndpointDefinition;
  slugs: Slug[];
}> => {
  const apis = await getAllApisForDomain(domain);
  for (const api of apis) {
    const endpoint = findEndpoint({
      apiDefinition: api,
      method,
      path,
      example,
    });
    if (endpoint != null) {
      const root = await unsafe_getFullRoot(domain);
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

const unsafe_getFullRoot = async (domain: string) => {
  try {
    const cached = await kvGet<FernNavigation.RootNode>(domain, "root");
    if (cached != null) {
      return cached;
    }
  } catch (error) {
    console.warn(
      `Failed to get full root for ${domain}, fallback to uncached`,
      error
    );
  }
  const response = await loadWithUrl(domain);
  const root = convertResponseToRootNode(
    response,
    await cachedGetEdgeFlags(domain)
  );
  if (root == null) {
    console.error("Could not find root node for domain", domain);
    notFound();
  }
  return root;
};

const unsafe_getRootCached = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string) => {
    return await unstable_cache(
      async (domain: string) => {
        try {
          const cached = await kvGet<FernNavigation.RootNode>(
            domain,
            "root",
            cacheConfig.cacheKeySuffix
          );
          if (cached != null) {
            return cached;
          }
        } catch (error) {
          console.warn(
            `Failed to get full root for ${domain}, fallback to uncached`,
            error
          );
        }

        // Get fresh data
        const root = await unsafe_getFullRoot(domain);

        // Cache the result
        kvSet(
          domain,
          "root",
          root,
          cacheConfig.kvTtl,
          cacheConfig.cacheKeySuffix
        );

        return root;
      },
      ["unsafe_getRoot", cacheSeed(), cacheConfig.cacheKeySuffix],
      { tags: [domain, "unsafe_getRoot"] }
    )(domain);
  });

const getRoot = async (
  domain: string,
  authState: AuthState,
  authConfig: AuthEdgeConfig | undefined,
  cacheConfig: Required<CacheConfig>
) => {
  let root = await unsafe_getRootCached(cacheConfig)(domain);
  if (authConfig) {
    root = pruneWithAuthState(authState, authConfig, root);
  }
  FernNavigation.utils.mutableUpdatePointsTo(root);
  return root;
};

const getRootCached = (cacheConfig: Required<CacheConfig>) =>
  cache(
    async (
      domain: string,
      authState: AuthState,
      authConfig: AuthEdgeConfig | undefined
    ) => {
      return await unstable_cache(
        (
          domain: string,
          authState: AuthState,
          authConfig: AuthEdgeConfig | undefined
        ) => getRoot(domain, authState, authConfig, cacheConfig),
        [domain, cacheSeed(), cacheConfig.cacheKeySuffix],
        { tags: [domain, "getRoot"] }
      )(domain, authState, authConfig);
    }
  );

const getNavigationNode = (cacheConfig: Required<CacheConfig>) =>
  cache(
    async (
      domain: string,
      id: string,
      authState: AuthState,
      authConfig: AuthEdgeConfig | undefined
    ) => {
      const root = await getRootCached(cacheConfig)(
        domain,
        authState,
        authConfig
      );
      const collector = FernNavigation.NodeCollector.collect(root);
      const node = collector.get(FernNavigation.NodeId(id));
      if (node == null) {
        console.error(`Could not find node ${id} for domain ${domain}`);
        notFound();
      }
      return node;
    }
  );

const getConfig = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string) => {
    try {
      const cached = await kvGet<
        Omit<DocsV1Read.DocsDefinition["config"], "navigation" | "root">
      >(domain, "config", cacheConfig.cacheKeySuffix);
      if (cached != null) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get config for ${domain}, fallback to uncached`,
        error
      );
    }

    const response = await loadWithUrl(domain);
    const { navigation, root, ...config } = response.definition.config;
    kvSet(
      domain,
      "config",
      config,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    return config;
  });

const getPage = (cacheConfig: Required<CacheConfig>) =>
  cache(
    async (
      domain: string,
      pageId: string,
      returnRawMarkdown: boolean = false
    ) => {
      try {
        const page = await kvGet<DocsV1Read.PageContent>(
          domain,
          `page:${pageId}`,
          cacheConfig.cacheKeySuffix
        );
        if (page != null && isPlainObject(page) && "markdown" in page) {
          const config = await getConfig(cacheConfig)(domain);
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
          `Failed to get page for ${domain}:${pageId}, fallback to uncached`,
          error
        );
      }

      const response = await loadWithUrl(domain);
      const page = response.definition.pages[pageId as PageId];
      if (page == null) {
        console.error(`Could not find page with ID ${pageId}`);
        notFound();
      }

      kvSet(
        domain,
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
  cache(async (domain: string) => {
    "use cache";
    unstable_cacheTag(domain, "getMdxBundlerFiles");

    try {
      const cached = await kvGet<Record<string, string>>(
        domain,
        "mdx-bundler-files",
        cacheConfig.cacheKeySuffix
      );
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get mdx bundler files for ${domain}, fallback to uncached`,
        error
      );
    }

    const response = await loadWithUrl(domain);
    const files = response.definition.jsFiles ?? {};
    kvSet(
      domain,
      "mdx-bundler-files",
      files,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    return files;
  });

const getColors = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string) => {
    "use cache";
    unstable_cacheTag(domain, "getColors");

    try {
      const cached = await kvGet<{
        light: FernColorTheme | undefined;
        dark: FernColorTheme | undefined;
      }>(domain, "colors", cacheConfig.cacheKeySuffix);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get colors for ${domain}, fallback to uncached`,
        error
      );
    }

    const [config, files] = await Promise.all([
      getConfig(cacheConfig)(domain),
      getFiles(cacheConfig)(domain),
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
      domain,
      "colors",
      colors,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    return colors;
  });

const getFonts = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string) => {
    "use cache";
    unstable_cacheTag(domain, "getFonts");

    try {
      const cached = await kvGet<FernFonts>(
        domain,
        "fonts",
        cacheConfig.cacheKeySuffix
      );
      if (cached != null) {
        return cached;
      }
    } catch (error) {
      console.warn(
        `Failed to get fonts for ${domain}, fallback to uncached`,
        error
      );
    }

    const response = await loadWithUrl(domain);
    const fonts = generateFonts(
      response.definition.config.typographyV2,
      await getFiles(cacheConfig)(domain)
    );
    kvSet(
      domain,
      "fonts",
      fonts,
      cacheConfig.kvTtl,
      cacheConfig.cacheKeySuffix
    );
    return fonts;
  });

const getLayout = (cacheConfig: Required<CacheConfig>) =>
  cache(async (domain: string) => {
    "use cache";
    unstable_cacheTag(domain, "getLayout");

    const config = await getConfig(cacheConfig)(domain);
    if (!config) {
      console.error("Could not find config for domain", domain);
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
      : (config.layout?.tabsPlacement ?? defaultTabsPlacement(domain));
    const searchbarPlacement = config.layout?.disableHeader
      ? "SIDEBAR"
      : (config.layout?.searchbarPlacement ??
        defaultSearchbarPlacement(domain));

    return {
      logoHeight,
      sidebarWidth,
      headerHeight,
      pageWidth,
      contentWidth,
      tabsPlacement,
      searchbarPlacement,
      isHeaderDisabled: config.layout?.disableHeader ?? false,
    };
  });

const getDynamicIr = (apiNames: string[]) =>
  cache(async (orgId: string) => {
    "use cache";
    unstable_cacheTag(orgId, "getDynamicIr");

    const response = await loadDynamicIRWithUrl({
      orgId,
      apiNames,
    });

    if (response) {
      return response;
    }

    return undefined;
  });

function defaultTabsPlacement(domain: string) {
  if (domain.includes("cohere")) {
    return "HEADER";
  }
  return "SIDEBAR";
}

function defaultSearchbarPlacement(domain: string) {
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
  domain: string,
  fern_token?: string,
  options?: DocsLoaderOptions
): Promise<DocsLoader & { clearKvCache: () => Promise<void> }> => {
  assertDocsDomain(domain);

  const config = { ...DEFAULT_CACHE_CONFIG, ...options?.cacheConfig };

  // Force revalidation if requested - only clear KV cache here
  if (config.forceRevalidate) {
    await clearKvCache(domain);
  }

  const authConfig = options?.skipAuth
    ? Promise.resolve(undefined)
    : getAuthConfig(domain);
  const metadata = getMetadata(config)(withoutStaging(domain));

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
          domain,
          fern_token,
          await authConfig,
          await metadata
        );
        return await getAuthState(pathname);
      });

  return {
    domain,
    fern_token,
    getAuthConfig: () => authConfig,
    getMetadata: () => metadata,
    getFiles: () => getFiles(config)(domain),
    getMdxBundlerFiles: () => getMdxBundlerFiles(config)(domain),
    getPrunedApi: cache(createGetPrunedApiCached(domain, config)),
    getEndpointById: cache((apiDefinitionId: string, endpointId: EndpointId) =>
      getEndpointById({
        domain,
        apiDefinitionId,
        endpointId,
        cacheConfig: config,
      })
    ),
    getEndpointByLocator: cache(
      unstable_cache(
        (method: HttpMethod, path: string, example?: string) =>
          getEndpointByLocator(domain, method, path, example),
        [domain, cacheSeed(), config.cacheKeySuffix],
        { tags: [domain, "endpointByLocator"] }
      )
    ),
    getRoot: async () =>
      getRootCached(config)(domain, await getAuthState(), await authConfig),
    getNavigationNode: async (id: string) =>
      getNavigationNode(config)(
        domain,
        id,
        await getAuthState(),
        await authConfig
      ),
    unsafe_getFullRoot: () => unsafe_getRootCached(config)(domain),
    getConfig: () => getConfig(config)(domain),
    getPage: (pageId) =>
      getPage(config)(domain, pageId, options?.returnRawMarkdown),
    getColors: () => getColors(config)(domain),
    getLayout: () => getLayout(config)(domain),
    getFonts: () => getFonts(config)(domain),
    getAuthState,
    getEdgeFlags: () => cachedGetEdgeFlags(domain),
    getBaseUrl: async () => {
      const m = await metadata;
      return `https://${m.domain}${m.basePath}`;
    },
    getDynamicIr: async (apiNames: string[]) => {
      const m = await metadata;
      return getDynamicIr(apiNames)(m.org);
    },
    clearKvCache: () => clearKvCache(domain),
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
