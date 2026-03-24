import type { AuthState } from "@fern-api/docs-server";
import type { DocsMetadata } from "@fern-api/docs-server/docs-loader";
import type { EdgeFlags, HttpMethod } from "@fern-api/docs-utils";
import { addLeadingSlash, conformTrailingSlash } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernNavigation } from "@fern-api/fdr-sdk";
import type { EndpointId } from "@fern-api/fdr-sdk/api-definition";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import type { MDXComponents } from "@fern-docs/mdx";
import { isToc, type TableOfContentsItem } from "@fern-docs/mdx";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Semaphore } from "es-toolkit";
import { getMDXExport } from "mdx-bundler/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { type ImageConfigComplete, imageConfigDefault } from "next/dist/shared/lib/image-config";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import React from "react";
import _jsx_runtime from "react/jsx-runtime";
import ReactDOM from "react-dom";
import { renderToString } from "react-dom/server";
import { safeParagraphJsxRuntime } from "@/mdx/bundler/safe-paragraph-jsx-runtime";
import { serializeMdx } from "@/mdx/bundler/serialize";
import { ClientContentError, EndpointNotInApiError, TypesNotInApiError } from "./errors";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

// ─── Next.js Context Providers for SSR ─────────────────
// Provides ImageConfigContext so next/image works in renderToString
const IMAGE_HOSTS = [
    "fdr-prod-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-prod-docs-files-public.s3.amazonaws.com",
    "fdr-dev2-docs-files.s3.us-east-1.amazonaws.com",
    "fdr-dev2-docs-files-public.s3.amazonaws.com",
    "files.buildwithfern.com",
    "files-dev2.buildwithfern.com",
    "icons.ferndocs.com"
];

const imageConfig: ImageConfigComplete = {
    ...imageConfigDefault,
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
        protocol: "https" as const,
        hostname
    }))
};

const stubRouter = {
    back: () => {},
    forward: () => {},
    push: () => {},
    replace: () => {},
    refresh: () => {},
    prefetch: () => Promise.resolve()
};

/**
 * Optional bundled context objects from @fern-docs/mdx-server-components.
 * When next/* is bundled into dist/index.js, React contexts are separate
 * JS objects from the host's imports. Passing the bundled copies here
 * ensures providers and consumers share the same context references.
 */
export interface BundledContexts {
    ImageConfigContext?: React.Context<any>;
    SearchParamsContext?: React.Context<any>;
    PathnameContext?: React.Context<any>;
    AppRouterContext?: React.Context<any>;
}

function createRenderWithNextContext(bundledContexts?: BundledContexts) {
    // Use bundled context objects if provided (local-remote mode),
    // otherwise fall back to the host's imports (production remote renderer)
    const ImgCtx = bundledContexts?.ImageConfigContext ?? ImageConfigContext;
    const SearchCtx = bundledContexts?.SearchParamsContext ?? SearchParamsContext;
    const PathCtx = bundledContexts?.PathnameContext ?? PathnameContext;
    const RouterCtx = bundledContexts?.AppRouterContext ?? AppRouterContext;

    return function renderWithNextContext(element: React.ReactElement, pathname: string): string {
        return renderToString(
            <ImgCtx.Provider value={imageConfig}>
                <RouterCtx.Provider value={stubRouter as any}>
                    <PathCtx.Provider value={pathname}>
                        <SearchCtx.Provider value={new URLSearchParams()}>
                            <TooltipProvider>{element}</TooltipProvider>
                        </SearchCtx.Provider>
                    </PathCtx.Provider>
                </RouterCtx.Provider>
            </ImgCtx.Provider>
        );
    };
}

// ─── Types ──────────────────────────────────────────────

export interface BatchItem {
    key: string;
    content: string;
    options: {
        filename?: string;
        toc?: boolean;
        scope?: Record<string, unknown>;
        slug?: string;
        pathname?: string;
    };
}

export interface PreResolvedLoaderData {
    resolvedEndpoints: Array<[string, any]>;
    resolvedEndpointDetails: Array<[string, any]>;
    resolvedWebhooks: Array<[string, any]>;
    resolvedTypes: Array<[string, any]>;
}

export interface LoaderContext {
    domain: string;
    edgeFlags: EdgeFlags;
    authState: AuthState;
    metadata: DocsMetadata;
    language: string;
    files: Record<string, FileData>;
    mdxBundlerFiles: Record<string, string>;
    config?: any;
    theme?: any;
    layout?: any;
    root?: any;
    settings?: any;
    rootSlug?: Slug;
    versionSlug?: Slug;
    slugMap?: Array<[string, { slug: Slug }]>;
    preResolved?: PreResolvedLoaderData;
}

export interface BatchRequest {
    items: BatchItem[];
    loaderContext: LoaderContext;
}

export interface RemoteMetadata {
    toc: TableOfContentsItem[];
    frontmatter: Record<string, unknown>;
    hasAside: boolean;
    asideHtml?: string;
}

export interface BatchResult {
    code: string;
    frontmatter?: Partial<FernDocs.Frontmatter>;
    jsxElements: string[];
    engine: "esbuild" | "next-remote" | "plaintext";
    styles?: string[];
    _contentHtml: string;
    _remoteMetadata: RemoteMetadata;
    /** Present when rendering failed; signals the client to show an error UI */
    _error?: { message: string };
}

// ─── Helpers ────────────────────────────────────────────

function asToc(value: unknown): TableOfContentsItem[] {
    return isToc(value) ? (value as TableOfContentsItem[]) : [];
}

function createReplaceHref(ctx: LoaderContext): ((href: string) => string | undefined) | undefined {
    if (!ctx.rootSlug && !ctx.versionSlug) {
        return undefined;
    }

    const slugMap = ctx.slugMap ? new Map(ctx.slugMap) : new Map();
    const rootSlug = ctx.rootSlug ?? "";
    const versionSlug = ctx.versionSlug;

    return (href: string): string | undefined => {
        if (href.startsWith("/")) {
            const url = new URL(href, withDefaultProtocol(ctx.domain));
            if (versionSlug != null) {
                const slugWithVersion = FernNavigation.slugjoin(versionSlug, url.pathname);
                const foundNode = slugMap.get(slugWithVersion) as { slug: Slug } | undefined;
                if (foundNode) {
                    return `${conformTrailingSlash(addLeadingSlash(foundNode.slug))}${url.search}${url.hash}`;
                }
            }

            if (rootSlug.length > 0) {
                const slugWithRoot = FernNavigation.slugjoin(rootSlug, url.pathname);
                const foundNode = slugMap.get(slugWithRoot) as { slug: Slug } | undefined;
                if (foundNode) {
                    return `${conformTrailingSlash(addLeadingSlash(foundNode.slug))}${url.search}${url.hash}`;
                }
            }
        }
        return;
    };
}

// ─── Pre-resolution Key Generators ──────────────────────
// These must match the key generators in pre-resolve-loader-data.ts

function endpointLocatorKey(method: HttpMethod, path: string, example?: string, apiName?: string): string {
    return `${method}::${path}::${example ?? ""}::${apiName ?? ""}`;
}

function endpointDetailsKey(apiDefinitionId: string, endpointId: EndpointId): string {
    return `${apiDefinitionId}::${endpointId}`;
}

/** Build a minimal loader shim from the serialized payload context. */
function createLoaderShim(ctx: LoaderContext) {
    // Convert pre-resolved arrays back to Maps for O(1) lookups
    const resolvedEndpoints = ctx.preResolved ? new Map(ctx.preResolved.resolvedEndpoints) : new Map();
    const resolvedEndpointDetails = ctx.preResolved ? new Map(ctx.preResolved.resolvedEndpointDetails) : new Map();
    const resolvedWebhooks = ctx.preResolved ? new Map(ctx.preResolved.resolvedWebhooks) : new Map();
    const resolvedTypes = ctx.preResolved ? new Map(ctx.preResolved.resolvedTypes) : new Map();

    return {
        domain: ctx.domain,
        getLanguage: async () => ctx.language,
        getFiles: async () => ctx.files,
        getMdxBundlerFiles: async () => ctx.mdxBundlerFiles,
        getFilesUncached: undefined,

        // Pre-resolved loader methods
        getEndpointByLocator: async (method: HttpMethod, path: string, example?: string, apiName?: string) => {
            const key = endpointLocatorKey(method, path, example, apiName);
            if (!resolvedEndpoints.has(key)) {
                // Key not in map at all = scanner didn't detect this endpoint reference
                throw new Error(
                    `Endpoint ${method} ${path}${apiName ? ` (api: ${apiName})` : ""}${example ? ` (example: ${example})` : ""} was not detected during MDX content scanning. ` +
                        `The endpoint prop may use a format the scanner doesn't recognize. ` +
                        `Available pre-resolved keys: [${[...resolvedEndpoints.keys()].join(", ")}]`
                );
            }
            const result = resolvedEndpoints.get(key);
            if (result === null) {
                // null = scanner found it, but the endpoint doesn't exist in the API definition
                throw new EndpointNotInApiError(method, path, apiName, example);
            }
            return result;
        },

        getEndpointById: async (apiDefinitionId: string, endpointId: EndpointId) => {
            const key = endpointDetailsKey(apiDefinitionId, endpointId);
            const result = resolvedEndpointDetails.get(key);
            if (!result) {
                throw new Error(
                    `Endpoint details for ${apiDefinitionId}::${endpointId} not found in pre-resolved data. ` +
                        `The endpoint may not have been successfully resolved during pre-resolution on the bundle server.`
                );
            }
            return result;
        },

        getWebhookByLocator: async (webhookId: string) => {
            const result = resolvedWebhooks.get(webhookId);
            return result;
        },

        getSettings: async () => {
            return ctx.settings ?? {};
        },

        getTypes: async (apiName?: string) => {
            const key = apiName ?? "";
            if (!resolvedTypes.has(key)) {
                // Key not in map at all = scanner didn't detect this API name reference
                throw new Error(
                    `Types for API "${apiName ?? "(default)"}" were not detected during MDX content scanning. ` +
                        `The API name may use a format the scanner doesn't recognize. ` +
                        `Available pre-resolved keys: [${[...resolvedTypes.keys()].join(", ")}]`
                );
            }
            const types = resolvedTypes.get(key);
            if (types === null) {
                // null = scanner found it, but the types couldn't be resolved from FDR
                throw new TypesNotInApiError(apiName);
            }
            return types;
        }
    };
}

/** Wraps the loader shim in a Proxy to catch unimplemented method calls */
function createLoaderShimWithProxy(ctx: LoaderContext): any {
    const shim = createLoaderShim(ctx);

    return new Proxy(shim, {
        get(target, prop) {
            if (prop in target) {
                return (target as any)[prop];
            }

            return () => {
                throw new Error(
                    `Loader method "${String(prop)}" is not implemented in the remote renderer shim. ` +
                        `This method needs to be pre-resolved on the bundle server and added to the loader shim. ` +
                        `Please update pre-resolve-loader-data.ts and createLoaderShim() in batch-serialize-handler.tsx.`
                );
            };
        }
    });
}

// ─── Core Handler ───────────────────────────────────────

// Limit concurrent MDX compilations to prevent memory/CPU overload
const monitor = new Semaphore(20);

/**
 * Shared batch-serialize handler used by both:
 * - The local remote builder API route (in the main bundle app for preview environments)
 * - The remote mdx-remote-renderer service (via @bundle/* webpack alias)
 *
 * Takes a parsed BatchRequest and returns a keyed map of results.
 * Framework-agnostic: callers handle request parsing and response formatting.
 */
/**
 * Creates a generic fallback component factory that renders all MDX tags as plain divs.
 * Used when no component factory is provided (e.g., local Pages Router routes where
 * importing the real component tree would pull in next/dynamic and break Turbopack).
 * The client-side RemoteMdxHydrator replaces these with real components during hydration.
 */
/**
 * Returns a human-readable identifier for a batch item.
 * Prefers slug or filename; falls back to a truncated content preview.
 */
function formatItemIdentifier(item: BatchItem): string {
    if (item.options.slug) {
        return item.options.slug;
    }
    if (item.options.filename) {
        return item.options.filename;
    }
    const preview = item.content.substring(0, 80).replace(/\n/g, " ");
    return `[inline-mdx: "${preview}${item.content.length > 80 ? "..." : ""}"]`;
}

function createFallbackComponents(jsxElements: string[]): MDXComponents {
    return jsxElements.reduce<Record<string, (props: { children?: React.ReactNode }) => React.ReactElement>>(
        (acc, tag) => {
            acc[tag] = (props: { children?: React.ReactNode }) =>
                React.createElement("div", { "data-mdx-component": tag }, props.children);
            return acc;
        },
        {}
    ) as unknown as MDXComponents;
}

export async function handleBatchSerialize(
    request: BatchRequest,
    logPrefix = "[batch-serialize]",
    createComponents?: (jsxElements: string[]) => MDXComponents,
    bundledContexts?: BundledContexts
): Promise<Record<string, BatchResult | null>> {
    const { items, loaderContext } = request;
    const loader = createLoaderShimWithProxy(loaderContext);
    const replaceHref = createReplaceHref(loaderContext);
    const renderWithNextContext = createRenderWithNextContext(bundledContexts);
    const startTime = Date.now();
    const pagePaths = items.map(formatItemIdentifier).filter(Boolean);
    const domainLabel = loaderContext.domain ?? "local";
    logger.debug(
        `${logPrefix} Received batch of ${items.length} items for domain: ${domainLabel}, pages: [${pagePaths.join(", ")}]`
    );

    const settled = await Promise.allSettled(
        items.map(async ({ key, content, options }, index) => {
            await monitor.acquire();

            try {
                const itemStart = Date.now();
                if (DEBUG) {
                    logger.debug(
                        `${logPrefix}   [${index + 1}/${items.length}] Processing: ${options.filename || "unknown"}`
                    );
                }

                const serialized = await serializeMdx(
                    content,
                    {
                        loader,
                        filename: options.filename,
                        toc: options.toc ?? false,
                        scope: {
                            authed: loaderContext.authState.authed,
                            ...(loaderContext.authState.authed ? { user: loaderContext.authState.user } : {}),
                            ...options.scope
                        },
                        slug: options.slug,
                        org: loaderContext.metadata.org,
                        domain: loaderContext.metadata.domain,
                        replaceHref
                    },
                    loaderContext.domain
                );

                if (!serialized) {
                    if (DEBUG) {
                        logger.debug(`${logPrefix}     Serialization returned null`);
                    }
                    return { key, result: null };
                }

                if (DEBUG) {
                    logger.debug(
                        `${logPrefix}     Compiled (engine: ${serialized.engine}, jsxElements: ${serialized.jsxElements.length})`
                    );
                }

                if (serialized.engine === "plaintext") {
                    return {
                        key,
                        result: {
                            ...serialized,
                            _contentHtml: serialized.code,
                            _remoteMetadata: {
                                toc: [],
                                frontmatter: {},
                                hasAside: false
                            }
                        } satisfies BatchResult
                    };
                }

                // ── Phase 2+3: Execute compiled code and render to HTML ──
                // Wrapped in try/catch so that a render failure (e.g. undefined component)
                // returns an error-flagged result instead of rejecting the whole item.
                try {
                    const componentFactory = createComponents ?? createFallbackComponents;
                    const components = componentFactory(serialized.jsxElements);

                    const exports = getMDXExport(serialized.code, {
                        MdxJsReact: { useMDXComponents: () => components },
                        React,
                        ReactDOM,
                        _jsx_runtime: safeParagraphJsxRuntime(_jsx_runtime)
                    });

                    const Component = exports.default;
                    const toc = asToc(exports?.toc);
                    const frontmatter = (exports?.frontmatter as Record<string, unknown>) ?? {};

                    const pathname = options.pathname ?? `/${options.slug ?? ""}`;
                    const contentHtml = renderWithNextContext(<Component />, pathname);

                    let asideHtml: string | undefined;
                    const Aside = exports?.Aside as React.ComponentType | undefined;
                    if (Aside) {
                        try {
                            asideHtml = renderWithNextContext(<Aside />, pathname);
                        } catch (e) {
                            logger.error(`${logPrefix} Aside render failed:`, e);
                        }
                    }

                    const itemDuration = Date.now() - itemStart;
                    if (DEBUG) {
                        logger.debug(`${logPrefix}   Complete (${itemDuration}ms)`);
                    }

                    return {
                        key,
                        result: {
                            ...serialized,
                            frontmatter: serialized.frontmatter ?? frontmatter,
                            _contentHtml: contentHtml,
                            _remoteMetadata: {
                                toc,
                                frontmatter,
                                hasAside: Aside != null,
                                asideHtml
                            }
                        } satisfies BatchResult
                    };
                } catch (renderError) {
                    const pagePath = options.slug || options.filename || "unknown";
                    if (renderError instanceof ClientContentError) {
                        logger.warn(
                            `${logPrefix} Client content error for ${loaderContext.domain}/${pagePath}: ${renderError.message}`
                        );
                    } else {
                        logger.error(
                            `${logPrefix} Render failed for ${loaderContext.domain}/${pagePath}:`,
                            renderError
                        );
                    }
                    return {
                        key,
                        result: {
                            ...serialized,
                            _contentHtml: "",
                            _remoteMetadata: { toc: [], frontmatter: {}, hasAside: false },
                            _error: {
                                message: renderError instanceof Error ? renderError.message : String(renderError)
                            }
                        } satisfies BatchResult
                    };
                }
            } finally {
                monitor.release();
            }
        })
    );

    // Build keyed result map
    const results: Record<string, BatchResult | null> = {};
    let successCount = 0;
    for (let i = 0; i < settled.length; i++) {
        const s = settled[i];
        const item = items[i];
        if (!item || !s) {
            continue;
        }

        if (s.status === "fulfilled" && s.value.result) {
            results[item.key] = s.value.result;
            successCount++;
        } else {
            results[item.key] = null;
            const pagePath = formatItemIdentifier(item);
            const errorDetail = s.status === "rejected" ? s.reason : "null result";
            const pageLabel = loaderContext.domain ? `${loaderContext.domain}/${pagePath}` : pagePath;
            const contentPreview = item.content.substring(0, 200).replace(/\n/g, " ");
            if (errorDetail instanceof ClientContentError) {
                logger.warn(`${logPrefix} Client content error on page: ${pageLabel}: ${errorDetail.message}`);
            } else {
                logger.error(
                    `${logPrefix} Failed page: ${pageLabel}\n  Content: "${contentPreview}${item.content.length > 200 ? "..." : ""}"`,
                    errorDetail
                );
            }
            if (!results._errors) {
                (results as any)._errors = {};
            }
            (results as any)._errors[item.key] =
                errorDetail instanceof Error
                    ? { message: errorDetail.message, stack: errorDetail.stack }
                    : String(errorDetail);
        }
    }

    const totalDuration = Date.now() - startTime;
    logger.debug(
        `${logPrefix} Complete: ${successCount}/${items.length} successful (${totalDuration}ms total, ~${Math.round(totalDuration / items.length)}ms/item)`
    );
    return results;
}
