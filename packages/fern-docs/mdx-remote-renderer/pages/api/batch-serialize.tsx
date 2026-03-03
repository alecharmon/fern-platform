// @ts-expect-error - Webpack resolves @bundle/* at runtime

import { serializeMdx } from "@bundle/mdx/bundler/serialize";
// @ts-expect-error - Webpack resolves @bundle/* at runtime
import { createMdxComponents } from "@bundle/mdx/components";
import type { AuthState } from "@fern-api/docs-server";
import type { DocsMetadata } from "@fern-api/docs-server/docs-loader";
import type { EdgeFlags } from "@fern-api/docs-utils";
import { addLeadingSlash, conformTrailingSlash } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { FernNavigation } from "@fern-api/fdr-sdk";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { isToc, type TableOfContentsItem } from "@fern-docs/mdx";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Semaphore } from "es-toolkit";
import { getMDXExport } from "mdx-bundler/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import React from "react";
import _jsx_runtime from "react/jsx-runtime";
import ReactDOM from "react-dom";
import { renderToString } from "react-dom/server";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

// Increase body size limit for large batches (API pages with many descriptions)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb"
        }
    }
};

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

interface BatchItem {
    key: string;
    content: string;
    options: {
        filename?: string;
        toc?: boolean;
        scope?: Record<string, unknown>;
        slug?: string;
        pathname?: string; // Full pathname for SSR context
    };
}

interface LoaderContext {
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
    rootSlug?: Slug;
    versionSlug?: Slug;
    slugMap?: Array<[string, { slug: Slug }]>;
    useNextMdx?: boolean;
}

interface BatchRequest {
    items: BatchItem[];
    loaderContext: LoaderContext;
}

interface RemoteMetadata {
    toc: TableOfContentsItem[];
    frontmatter: Record<string, unknown>;
    hasAside: boolean;
    asideHtml?: string;
}

interface BatchResult {
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

/** Build a minimal loader shim from the serialized payload context. */
function createLoaderShim(ctx: LoaderContext) {
    return {
        domain: ctx.domain,
        getLanguage: async () => ctx.language,
        getFiles: async () => ctx.files,
        getMdxBundlerFiles: async () => ctx.mdxBundlerFiles,
        getFilesUncached: undefined
    };
}

// ─── Endpoint ───────────────────────────────────────────

// Limit concurrent MDX compilations to prevent memory/CPU overload
const monitor = new Semaphore(20);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { items, loaderContext }: BatchRequest = req.body;

    if (!items?.length || !loaderContext) {
        return res.status(400).json({ error: "items[] and loaderContext required" });
    }

    const loader = createLoaderShim(loaderContext);
    const replaceHref = createReplaceHref(loaderContext);
    const startTime = Date.now();
    console.log(`[batch-serialize] 📥 Received batch of ${items.length} items for domain: ${loaderContext.domain}`);

    const settled = await Promise.allSettled(
        items.map(async ({ key, content, options }, index) => {
            // Acquire semaphore to limit concurrent compilations
            await monitor.acquire();

            try {
                const itemStart = Date.now();
                if (DEBUG) {
                    console.log(
                        `[batch-serialize]   [${index + 1}/${items.length}] Processing: ${options.filename || "unknown"}`
                    );
                }

                if (DEBUG) {
                    console.log(`[batch-serialize]     ⚙  Vector 1: Compiling MDX (${content.length} chars)...`);
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
                        replaceHref,
                        useNextMdx: loaderContext.useNextMdx
                    },
                    loaderContext.domain
                );

                if (!serialized) {
                    if (DEBUG) {
                        console.log(`[batch-serialize]     !  Serialization returned null`);
                    }
                    return { key, result: null };
                }

                if (DEBUG) {
                    console.log(
                        `[batch-serialize]     ✅ Compiled (engine: ${serialized.engine}, jsxElements: ${serialized.jsxElements.length})`
                    );
                }

                if (serialized.engine === "plaintext") {
                    if (DEBUG) {
                        console.log(`[batch-serialize]     📄 Plaintext engine: returning code as-is`);
                    }
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

                // ── Phase 2: Execute compiled code (Vector 2) ──
                if (DEBUG) {
                    console.log(`[batch-serialize]     📊 Vector 2: Extracting metadata via getMDXExport...`);
                }

                const components = createMdxComponents(serialized.jsxElements);
                if (DEBUG) {
                    console.log(
                        `[batch-serialize]       Created ${Object.keys(components).length} component overrides`
                    );
                }

                const exports = getMDXExport(serialized.code, {
                    MdxJsReact: { useMDXComponents: () => components },
                    React,
                    ReactDOM,
                    _jsx_runtime
                });

                const Component = exports.default;
                const toc = asToc(exports?.toc);
                const frontmatter = (exports?.frontmatter as Record<string, unknown>) ?? {};
                if (DEBUG) {
                    console.log(
                        `[batch-serialize]       Extracted: toc (${toc.length} items), frontmatter (${Object.keys(frontmatter).length} fields)`
                    );
                }

                // ── Phase 3: Render to HTML (Vector 3) ──
                if (DEBUG) {
                    console.log(`[batch-serialize]     🎨 Vector 3: Rendering to HTML...`);
                }

                // Provide Next.js routing context via providers (usePathname, useRouter, useSearchParams)
                const pathname = options.pathname ?? `/${options.slug ?? ""}`;
                if (DEBUG) {
                    console.log(`[batch-serialize]       Using pathname for SSR context: ${pathname}`);
                }

                const contentHtml = renderWithNextContext(<Component />, pathname);
                if (DEBUG) {
                    console.log(`[batch-serialize]       Main content: ${contentHtml.length} chars`);
                }

                let asideHtml: string | undefined;
                const Aside = exports?.Aside as React.ComponentType | undefined;
                if (Aside) {
                    try {
                        if (DEBUG) {
                            console.log(`[batch-serialize]       📝 Rendering Aside component...`);
                        }
                        asideHtml = renderWithNextContext(<Aside />, pathname);
                        if (DEBUG) {
                            console.log(`[batch-serialize]       Aside content: ${asideHtml.length} chars`);
                        }
                    } catch (e) {
                        console.error(`[batch-serialize]       ❌ Aside render failed:`, e);
                    }
                }

                const itemDuration = Date.now() - itemStart;
                if (DEBUG) {
                    console.log(`[batch-serialize]     ✅ Complete (${itemDuration}ms)`);
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
            console.error(
                `[batch-serialize]   ❌ Failed: ${item.key}`,
                s.status === "rejected" ? s.reason : "null result"
            );
        }
    }

    const totalDuration = Date.now() - startTime;
    console.log(
        `[batch-serialize] 📤 Complete: ${successCount}/${items.length} successful (${totalDuration}ms total, ~${Math.round(totalDuration / items.length)}ms/item)`
    );
    return res.status(200).json(results);
}
