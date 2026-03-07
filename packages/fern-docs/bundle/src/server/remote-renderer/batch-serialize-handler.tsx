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
import type { MDXComponents } from "@fern-docs/mdx";
import { isToc, type TableOfContentsItem } from "@fern-docs/mdx";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Semaphore } from "es-toolkit";
import { getMDXExport } from "mdx-bundler/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import React from "react";
import _jsx_runtime from "react/jsx-runtime";
import ReactDOM from "react-dom";
import { renderToString } from "react-dom/server";
import { serializeMdx } from "@/mdx/bundler/serialize";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

// ─── Next.js Context Providers for SSR ─────────────────

const stubRouter = {
    back: () => {},
    forward: () => {},
    push: () => {},
    replace: () => {},
    refresh: () => {},
    prefetch: () => Promise.resolve()
};

function renderWithNextContext(element: React.ReactElement, pathname: string): string {
    return renderToString(
        <AppRouterContext.Provider value={stubRouter as any}>
            <PathnameContext.Provider value={pathname}>
                <SearchParamsContext.Provider value={new URLSearchParams()}>
                    <TooltipProvider>{element}</TooltipProvider>
                </SearchParamsContext.Provider>
            </PathnameContext.Provider>
        </AppRouterContext.Provider>
    );
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
            const result = resolvedEndpoints.get(key);
            if (!result) {
                throw new Error(
                    `Endpoint ${method} ${path} not found in pre-resolved data. This is a bug in the remote renderer pre-resolution logic.`
                );
            }
            return result;
        },

        getEndpointById: async (apiDefinitionId: string, endpointId: EndpointId) => {
            const key = endpointDetailsKey(apiDefinitionId, endpointId);
            const result = resolvedEndpointDetails.get(key);
            if (!result) {
                throw new Error(
                    `Endpoint details for ${apiDefinitionId}::${endpointId} not found in pre-resolved data. This is a bug in the remote renderer pre-resolution logic.`
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
            const types = resolvedTypes.get(key);
            if (!types) {
                console.warn(
                    `[batch-serialize] getTypes() called with apiName="${apiName ?? "(default)"}" but not found in pre-resolved data. Returning empty object.`
                );
                return {};
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
    createComponents?: (jsxElements: string[]) => MDXComponents
): Promise<Record<string, BatchResult | null>> {
    const { items, loaderContext } = request;
    const loader = createLoaderShimWithProxy(loaderContext);
    const replaceHref = createReplaceHref(loaderContext);
    const startTime = Date.now();
    const pagePaths = items.map((item) => item.options.slug || item.options.filename || item.key).filter(Boolean);
    console.log(
        `${logPrefix} Received batch of ${items.length} items for domain: ${loaderContext.domain}, pages: [${pagePaths.join(", ")}]`
    );

    const settled = await Promise.allSettled(
        items.map(async ({ key, content, options }, index) => {
            await monitor.acquire();

            try {
                const itemStart = Date.now();
                if (DEBUG) {
                    console.log(
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
                        console.log(`${logPrefix}     Serialization returned null`);
                    }
                    return { key, result: null };
                }

                if (DEBUG) {
                    console.log(
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

                // ── Phase 2: Execute compiled code ──
                const componentFactory = createComponents ?? createFallbackComponents;
                const components = componentFactory(serialized.jsxElements);

                const exports = getMDXExport(serialized.code, {
                    MdxJsReact: { useMDXComponents: () => components },
                    React,
                    ReactDOM,
                    _jsx_runtime
                });

                const Component = exports.default;
                const toc = asToc(exports?.toc);
                const frontmatter = (exports?.frontmatter as Record<string, unknown>) ?? {};

                // ── Phase 3: Render to HTML ──
                const pathname = options.pathname ?? `/${options.slug ?? ""}`;
                const contentHtml = renderWithNextContext(<Component />, pathname);

                let asideHtml: string | undefined;
                const Aside = exports?.Aside as React.ComponentType | undefined;
                if (Aside) {
                    try {
                        asideHtml = renderWithNextContext(<Aside />, pathname);
                    } catch (e) {
                        console.error(`${logPrefix} Aside render failed:`, e);
                    }
                }

                const itemDuration = Date.now() - itemStart;
                if (DEBUG) {
                    console.log(`${logPrefix}   Complete (${itemDuration}ms)`);
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
            const pagePath = item.options?.slug || item.options?.filename || item.key;
            console.error(
                `${logPrefix} Failed page: ${loaderContext.domain}/${pagePath}`,
                s.status === "rejected" ? s.reason : "null result"
            );
        }
    }

    const totalDuration = Date.now() - startTime;
    console.log(
        `${logPrefix} Complete: ${successCount}/${items.length} successful (${totalDuration}ms total, ~${Math.round(totalDuration / items.length)}ms/item)`
    );
    return results;
}
