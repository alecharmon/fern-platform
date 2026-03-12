import type { CachedDocsLoader } from "@fern-api/docs-loader";
import { cacheSeed } from "@fern-api/docs-server/cache-seed";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import type { TableOfContentsItem } from "@fern-docs/mdx";
import { unstable_cache } from "next/cache";
import type { RehypeLinksOptions } from "@/mdx/plugins/rehype-links";
import type { MdxSerializer, MdxSerializerOptions } from "../mdx-serializer";
import { preResolveLoaderData } from "./pre-resolve-loader-data";
import { REMOTE_MDX_PIPELINE_VERSION } from "./remote-mdx-pipeline-version";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

/**
 * Extended fields that the remote batch serializer attaches to the standard serialize result.
 * These are used by MdxContent and LayoutEvaluator to avoid calling getMDXExport / new Function()
 * on the bundle server.
 */
export interface RemoteMdxFields {
    /** Pre-rendered HTML from remote renderer (for SEO / initial paint) */
    _contentHtml?: string;
    /** Pre-computed metadata from remote getMDXExport (closes Vector 2) */
    _remoteMetadata?: {
        toc?: TableOfContentsItem[];
        frontmatter?: Record<string, unknown>;
        hasAside?: boolean;
        asideHtml?: string;
    };
}

interface BatchEntry {
    content: string;
    options: MdxSerializerOptions;
    resolve: (result: BatchSerializeResult | undefined) => void;
    reject: (error: Error) => void;
}

/** The result shape returned by the remote batch-serialize endpoint */
export type BatchSerializeResult = NonNullable<Awaited<ReturnType<MdxSerializer>>> & RemoteMdxFields;

function hashKey(content: string, options: MdxSerializerOptions): string {
    const scopeKey = options.scope ? JSON.stringify(options.scope) : "";
    return `${content}::${options.filename ?? ""}::${options.toc ?? false}::${options.slug ?? ""}::${scopeKey}`;
}

function isPlainText(content: string): boolean {
    if (content.length === 0) {
        return true;
    }
    return /^[a-zA-Z0-9\s.,'"!?]*$/.test(content);
}

export interface RemoteSerializerOptions {
    scope?: Record<string, unknown>;
    replaceHref?: RehypeLinksOptions["replaceHref"];
    rootSlug?: Slug;
    versionSlug?: Slug;
    slugMap?: Map<string, unknown>;
    useNextMdx?: boolean;
    /** Override the batch-serialize endpoint path (default: /api/batch-serialize) */
    batchSerializePath?: string;
    /** When true, logs use [RemoteBatchSerializer:SHADOW] prefix for distinguishing shadow traffic */
    isShadow?: boolean;
}

/**
 * Creates a DataLoader-style batching MDX serializer that collects all serialize()
 * calls within a single React render pass and sends them to the remote renderer
 * in one HTTP request.
 *
 * Uses process.nextTick to flush the batch after all synchronous serialize calls
 * are collected during React's server component tree traversal.
 *
 * This ensures that even API pages with 500+ property descriptions result in
 * a single HTTP round-trip to the remote renderer.
 *
 * ## Remote Renderer Endpoint Contract
 *
 * The remote renderer must expose `POST /api/batch-serialize` that:
 *
 * **Input:** `{ items: Array<{ key: string, content: string, options: MdxSerializerOptions }>, loaderContext: LoaderContext }`
 *
 * **For each item, it must:**
 * 1. `serializeMdx(content, options)` — compile MDX via esbuild (closes Vector 1)
 * 2. `getMDXExport(serialized)` — evaluate compiled code for metadata (closes Vector 2)
 * 3. `renderToString(<MDXProvider><Component /></MDXProvider>)` — render to HTML (closes Vector 3)
 *
 * **Output:** `Record<string, BatchResult | null>` keyed by item key, where BatchResult includes:
 * - `code`, `frontmatter`, `jsxElements`, `engine`, `scope`, `styles` (standard serialize fields)
 * - `_contentHtml` — pre-rendered HTML string
 * - `_remoteMetadata` — `{ toc, frontmatter, hasAside, asideHtml }`
 */
export function createBatchingRemoteMdxSerializer(
    remoteRendererUrl: string,
    loader?: CachedDocsLoader,
    options?: RemoteSerializerOptions
): MdxSerializer {
    const batchSerializePath = options?.batchSerializePath ?? "/api/batch-serialize";
    const logPrefix = options?.isShadow ? "[RemoteBatchSerializer:SHADOW]" : "[RemoteBatchSerializer]";
    let queue: BatchEntry[] = [];
    let scheduled = false;

    // Start fetching loader context immediately (overlaps with batching window)
    // This I/O runs in parallel while setTimeout(0) collects items into the queue
    const loaderContextPromise: Promise<any> = (async () => {
        if (!loader) {
            return {
                edgeFlags: {},
                authState: { authed: false },
                metadata: {},
                language: "en",
                files: {},
                mdxBundlerFiles: {},
                domain: undefined,
                rootSlug: options?.rootSlug,
                versionSlug: options?.versionSlug,
                slugMap: options?.slugMap
                    ? Array.from(options.slugMap.entries()).map(([key, node]) => [key, { slug: (node as any)?.slug }])
                    : undefined,
                useNextMdx: options?.useNextMdx
            };
        }

        const [edgeFlags, authState, metadata, language, files, mdxBundlerFiles, config, theme, layout, settings] =
            await Promise.all([
                loader.getEdgeFlags(),
                loader.getAuthState(),
                loader.getMetadata(),
                loader.getLanguage(),
                loader.getFiles(),
                loader.getMdxBundlerFiles(),
                loader.getConfig(),
                loader.getTheme(),
                loader.getLayout(),
                loader.getSettings()
            ]);
        return {
            edgeFlags,
            authState,
            metadata,
            language,
            files,
            mdxBundlerFiles,
            config,
            theme,
            layout,
            settings,
            domain: loader.domain,
            rootSlug: options?.rootSlug,
            versionSlug: options?.versionSlug,
            slugMap: options?.slugMap
                ? Array.from(options.slugMap.entries()).map(([key, node]) => [key, { slug: (node as any)?.slug }])
                : undefined,
            useNextMdx: options?.useNextMdx
        };
    })();

    async function flush(): Promise<void> {
        const batch = queue;
        queue = [];
        scheduled = false;

        if (batch.length === 0) {
            return;
        }

        // Deduplicate identical content strings (common in API pages where
        // the same type description appears in multiple type variants)
        const uniqueItems = new Map<string, { content: string; options: MdxSerializerOptions }>();
        for (const item of batch) {
            const key = hashKey(item.content, item.options);
            if (!uniqueItems.has(key)) {
                uniqueItems.set(key, { content: item.content, options: item.options });
            }
        }

        try {
            const startTime = Date.now();
            if (DEBUG) {
                console.log(
                    `${logPrefix} 🚀 Flushing batch: ${batch.length} calls, ${uniqueItems.size} unique items → POST ${remoteRendererUrl}${batchSerializePath}`
                );
            }

            // Await the loader context (started eagerly at serializer creation)
            const loaderContext = await loaderContextPromise;

            // Pre-resolve loader data by scanning MDX content for endpoint/webhook references
            const contents = [...uniqueItems.values()].map((item) => item.content);
            const preResolved = await preResolveLoaderData(loader, contents);

            // Convert Maps to arrays for JSON serialization
            const preResolvedSerialized = {
                resolvedEndpoints: Array.from(preResolved.resolvedEndpoints.entries()),
                resolvedEndpointDetails: Array.from(preResolved.resolvedEndpointDetails.entries()),
                resolvedWebhooks: Array.from(preResolved.resolvedWebhooks.entries()),
                resolvedTypes: Array.from(preResolved.resolvedTypes.entries())
            };

            // Build request body
            const items = [...uniqueItems.entries()].map(([key, item]) => {
                const pathname = item.options.slug
                    ? `/_/${loaderContext.domain}/_/_/_/${item.options.slug}`
                    : undefined;

                return {
                    key,
                    content: item.content,
                    options: {
                        ...item.options,
                        pathname,
                        scope: {
                            ...(item.options.scope ?? {}),
                            ...(options?.scope ?? {})
                        }
                    }
                };
            });

            const requestBody = {
                items,
                loaderContext: {
                    ...loaderContext,
                    preResolved: preResolvedSerialized
                }
            };

            // Debug: Log payload size breakdown
            if (DEBUG) {
                const itemsSize = JSON.stringify(items).length;
                const loaderContextSize = JSON.stringify(loaderContext).length;
                const totalSize = JSON.stringify(requestBody).length;
                const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

                console.log(`${logPrefix} 📦 Request payload size:`);
                console.log(`${logPrefix} Total: ${totalSize.toLocaleString()} bytes (${sizeMB} MB)`);
                console.log(`${logPrefix} Items (${items.length}): ${itemsSize.toLocaleString()} bytes`);
                console.log(`${logPrefix} LoaderContext: ${loaderContextSize.toLocaleString()} bytes`);

                // Break down loader context by field
                const contextBreakdown: Record<string, number> = {};
                for (const [field, value] of Object.entries(loaderContext)) {
                    const stringified = JSON.stringify(value);
                    contextBreakdown[field] = stringified ? stringified.length : 0;
                }
                const sortedFields = Object.entries(contextBreakdown).sort((a, b) => b[1] - a[1]);
                console.log(`${logPrefix} LoaderContext breakdown (largest first):`);
                for (const [field, size] of sortedFields.slice(0, 5)) {
                    console.log(`${logPrefix}     ${field}: ${size.toLocaleString()} bytes`);
                }
            }

            // ONE HTTP request for ALL serialize calls in this render pass
            const response = await fetch(`${remoteRendererUrl}${batchSerializePath}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    `${logPrefix} Remote batch serialize failed: ${response.status} ${response.statusText} at ${remoteRendererUrl}${batchSerializePath}`,
                    errorText
                );
                throw new Error(
                    `${logPrefix} Remote batch serialize failed: ${response.status} ${response.statusText} at ${remoteRendererUrl}${batchSerializePath}`
                );
            }

            const resultMap: Record<string, BatchSerializeResult | null> = await response.json();
            const duration = Date.now() - startTime;

            const successCount = Object.values(resultMap).filter((r) => r !== null).length;
            if (DEBUG) {
                console.log(
                    `${logPrefix} ✅ Received results: ${successCount}/${uniqueItems.size} successful (${duration}ms)`
                );
            }

            // Resolve every caller's promise with their corresponding result
            for (const entry of batch) {
                const key = hashKey(entry.content, entry.options);
                const result = resultMap[key];
                if (result != null) {
                    entry.resolve(result);
                } else {
                    // Resolve with undefined instead of rejecting so that a single failed
                    // serialization does not take down the entire page render.
                    console.error(
                        `[RemoteBatchSerializer] Remote serialization returned null for key: ${key.substring(0, 80)}`
                    );
                    entry.resolve(undefined);
                }
            }
        } catch (error) {
            console.error(`${logPrefix} Batch serialize failed at ${remoteRendererUrl}${batchSerializePath}:`, error);
            // Resolve with undefined instead of rejecting so that a batch-level failure
            // does not take down the entire page render.
            for (const entry of batch) {
                entry.resolve(undefined);
            }
        }
    }

    const serialize: MdxSerializer = async (content: string | undefined, options: MdxSerializerOptions = {}) => {
        if (content == null) {
            return undefined;
        }

        // Plain text short-circuit — safe, no code execution needed
        if (isPlainText(content)) {
            if (DEBUG) {
                console.log(
                    `${logPrefix} ⚡ Plain text short-circuit for "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`
                );
            }
            return {
                code: content,
                jsxElements: [],
                engine: "plaintext" as const
            };
        }

        // Per-item caching with Next.js unstable_cache
        // Cache key: [domain, content, cacheSeed()] + serialized options (automatic via function arg)
        // On cache hit: Returns result immediately without HTTP call
        // On cache miss: Queues for batch, waits for result, caches it, then returns
        //
        // Note: This works alongside batch-cache-api-descriptions.ts:
        // - Batch cache (high level): caches chunks of API type definitions before serialization
        // - Per-item cache (low level): caches individual serialize calls for docs pages, endpoint descriptions, etc.
        const domain = loader?.domain ?? "";

        const cachedFn = unstable_cache(
            async (opts: MdxSerializerOptions) => {
                if (DEBUG) {
                    console.log(
                        `${logPrefix} 💾 Cache miss - queueing for batch: ${opts.filename || "unknown"} (${content.substring(0, 30)}...)`
                    );
                }
                return new Promise<BatchSerializeResult | undefined>((resolve, reject) => {
                    queue.push({ content, options: opts, resolve, reject });

                    if (!scheduled) {
                        scheduled = true;
                        if (DEBUG) {
                            console.log(`${logPrefix} ⏰ Scheduling flush via setTimeout(0) (first item in batch)`);
                        }
                        // setTimeout(0) creates a batching window in the next event loop cycle,
                        // allowing parallel async operations (e.g., Promise.all) to queue their
                        // items before the batch flushes. This is crucial for API pages with
                        // many type descriptions that serialize in parallel.
                        setTimeout(() => void flush(), 0);
                    }
                });
            },
            [domain, content, cacheSeed(), REMOTE_MDX_PIPELINE_VERSION],
            { tags: [`${domain}:mdx`, "serializeMdx"] }
        );

        // unstable_cache automatically includes serialized function arguments in cache key
        // So { toc: true, slug: "api/users" } vs { toc: false, slug: "guides/intro" } are distinct cache entries
        return await cachedFn(options);
    };

    return serialize;
}

/**
 * Wraps a local MdxSerializer to also fire-and-forget requests to the remote renderer.
 * The local result is always returned immediately; the shadow is purely for error detection.
 *
 * The shadow serializer reuses createBatchingRemoteMdxSerializer, so parallel serialize()
 * calls within a render pass are naturally batched into a single shadow HTTP request.
 */
export function withShadowRemoteSerializer(
    localSerializer: MdxSerializer,
    remoteRendererUrl: string,
    loader?: CachedDocsLoader,
    options?: RemoteSerializerOptions
): MdxSerializer {
    const shadowSerializer = createBatchingRemoteMdxSerializer(remoteRendererUrl, loader, {
        ...options,
        isShadow: true
    });

    return async (content, opts) => {
        const result = await localSerializer(content, opts);

        // Fire and forget — shadow only, swallow all errors
        if (content != null) {
            shadowSerializer(content, opts)?.catch((e: Error) =>
                console.warn(
                    `[shadow-remote] ${loader?.domain ?? "unknown"}/${opts?.filename ?? "unknown"}: ${e.message}`
                )
            );
        }

        return result;
    };
}

/**
 * Helper to get remote renderer URL from env or explicit param.
 * Returns null if remote rendering is not configured.
 */
export function getRemoteRendererUrl(explicitUrl?: string): string | null {
    return explicitUrl ?? process.env.REMOTE_RENDERER_URL ?? null;
}
