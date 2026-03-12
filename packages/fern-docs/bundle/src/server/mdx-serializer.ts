import "server-only";

import type { CachedDocsLoader } from "@fern-api/docs-loader";
import { cacheSeed } from "@fern-api/docs-server/cache-seed";
import type { Frontmatter } from "@fern-api/fdr-sdk/docs";
import { logger } from "@fern-api/ui-core-utils/logger";
import { Semaphore } from "es-toolkit";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { serializeMdx as internalSerializeMdx } from "@/mdx/bundler/serialize";
import { serializeMdxImpl as internalSerializeNextMdxRemote } from "@/mdx/bundler/serializeWithNextMdxRemote";
import type { RehypeLinksOptions } from "@/mdx/plugins/rehype-links";
import { runAsyncSpan } from "@/server/tracing";

export type MdxSerializerOptions = {
    /**
     * The filename of the file being serialized.
     */
    filename?: string;
    /**
     * @default false
     */
    toc?: boolean;
    /**
     * The scope to inject into the mdx.
     */
    scope?: Record<string, unknown>;
    /**
     * The slug of the page being serialized.
     */
    slug?: string;
    /**
     * The function to replace links with the current version or basepath
     */
    replaceHref?: RehypeLinksOptions["replaceHref"];
};

export type MdxSerializer = (
    content: string | undefined,
    options?: MdxSerializerOptions
) => Promise<
    | {
          code: string;
          frontmatter?: Partial<Frontmatter>;
          jsxElements: string[];
          engine: "esbuild" | "next-remote" | "plaintext";
          styles?: string[];
      }
    | undefined
>;

const monitor = new Semaphore(20);

export function createCachedMdxSerializer(
    loader: CachedDocsLoader,
    {
        scope,
        replaceHref,
        useNextMdx
    }: {
        scope?: Record<string, unknown>;
        replaceHref?: RehypeLinksOptions["replaceHref"];
        useNextMdx?: boolean;
    } = {}
) {
    const domain = loader.domain;
    const serializer = async (content: string | undefined, options: MdxSerializerOptions = {}) => {
        if (content == null) {
            return;
        }

        if (isPlainText(content)) {
            return {
                code: content,
                jsxElements: [],
                engine: "plaintext" as const
            };
        }

        await monitor.acquire();

        try {
            return await runAsyncSpan(
                "mdx.serialize",
                async (span) => {
                    span.setAttributes({
                        "fern.docs.domain": domain,
                        "fern.docs.filename": options.filename ?? "unknown",
                        "fern.docs.mdx.useNextMdx": Boolean(useNextMdx)
                    });

                    const startTime = Date.now();
                    logger.debug(
                        `[serializeMdx] starting serialization for domain: ${domain}, filename: ${options.filename || "unknown"}`
                    );

                    const cachedSerializer = unstable_cache(
                        async ({ filename, toc, scope }: MdxSerializerOptions) => {
                            return runAsyncSpan(
                                "mdx.serialize.cacheWork",
                                async (cacheSpan) => {
                                    cacheSpan.setAttributes({
                                        "fern.docs.domain": domain,
                                        "fern.docs.filename": filename ?? "unknown"
                                    });
                                    const cacheStartTime = Date.now();
                                    logger.debug(
                                        `[serializeMdx] inside cache function for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${cacheStartTime - startTime}ms`
                                    );

                                    const [authState, metadata] = await Promise.all([
                                        runAsyncSpan("mdx.loader.getAuthState", () => loader.getAuthState(), {
                                            "fern.docs.domain": domain
                                        }),
                                        runAsyncSpan("mdx.loader.getMetadata", () => loader.getMetadata(), {
                                            "fern.docs.domain": domain
                                        })
                                    ]);

                                    try {
                                        if (useNextMdx) {
                                            try {
                                                const nextMdxStartTime = Date.now();
                                                logger.debug(
                                                    `[serializeMdx] using NextMdxRemote for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${nextMdxStartTime - startTime}ms`
                                                );
                                                const result = await runAsyncSpan(
                                                    "mdx.serialize.nextMdxRemote",
                                                    () =>
                                                        internalSerializeNextMdxRemote(content, {
                                                            loader,
                                                            scope: {
                                                                authed: authState.authed,
                                                                user: authState.authed ? authState.user : undefined,
                                                                ...scope
                                                            },
                                                            replaceHref
                                                        }),
                                                    {
                                                        "fern.docs.domain": domain,
                                                        "fern.docs.filename": filename ?? "unknown"
                                                    }
                                                );

                                                if (result && containsInvalidAwait(result.code)) {
                                                    throw new Error(
                                                        "NextMdxRemote generated invalid code with await statements, trying regular MDX serialization"
                                                    );
                                                }

                                                const nextMdxEndTime = Date.now();
                                                logger.debug(
                                                    `[serializeMdx] NextMdxRemote succeeded for domain: ${domain}, filename: ${filename || "unknown"}, duration: ${nextMdxEndTime - nextMdxStartTime}ms, total: ${nextMdxEndTime - startTime}ms`
                                                );
                                                return result;
                                            } catch (nextMdxError) {
                                                cacheSpan.addEvent("next_mdx_remote_failed");
                                                logger.error(
                                                    `[serializeMdx] NextMdxRemote failed for domain: ${domain}, filename: ${filename || "unknown"}, content length: ${content.length}`,
                                                    nextMdxError
                                                );
                                                logger.error(
                                                    `[serializeMdx] NextMdxRemote error stack for domain: ${domain}, filename: ${filename || "unknown"}:`,
                                                    nextMdxError instanceof Error
                                                        ? nextMdxError.stack
                                                        : "No stack trace available"
                                                );
                                                try {
                                                    const fallbackStartTime = Date.now();
                                                    logger.debug(
                                                        `[serializeMdx] NextMdxRemote failed, falling back to regular serialization for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${fallbackStartTime - startTime}ms`
                                                    );
                                                    const result = await runAsyncSpan(
                                                        "mdx.serialize.fallback",
                                                        () =>
                                                            internalSerializeMdx(
                                                                content,
                                                                {
                                                                    filename,
                                                                    loader,
                                                                    toc,
                                                                    scope: {
                                                                        authed: authState.authed,
                                                                        user: authState.authed
                                                                            ? authState.user
                                                                            : undefined,
                                                                        ...scope
                                                                    },
                                                                    replaceHref,
                                                                    org: metadata.org,
                                                                    domain: metadata.domain,
                                                                    slug: options.slug
                                                                },
                                                                metadata.domain
                                                            ),
                                                        {
                                                            "fern.docs.domain": domain,
                                                            "fern.docs.filename": filename ?? "unknown"
                                                        }
                                                    );
                                                    const fallbackEndTime = Date.now();
                                                    logger.debug(
                                                        `[serializeMdx] fallback serialization succeeded for domain: ${domain}, filename: ${filename || "unknown"}, duration: ${fallbackEndTime - fallbackStartTime}ms, total: ${fallbackEndTime - startTime}ms`
                                                    );
                                                    return result;
                                                } catch (fallbackError) {
                                                    cacheSpan.recordException(fallbackError as Error);
                                                    logger.error(
                                                        `[serializeMdx] Both engines failed serializing mdx for domain: ${domain}, filename: ${filename || "unknown"}, content length: ${content.length}`,
                                                        { nextMdxError, fallbackError }
                                                    );
                                                    logger.error(
                                                        `[serializeMdx] Fallback error stack for domain: ${domain}, filename: ${filename || "unknown"}:`,
                                                        fallbackError instanceof Error
                                                            ? fallbackError.stack
                                                            : "No stack trace available"
                                                    );

                                                    return undefined;
                                                }
                                            }
                                        } else {
                                            const regularStartTime = Date.now();
                                            logger.debug(
                                                `[serializeMdx] using regular serialization for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${regularStartTime - startTime}ms`
                                            );
                                            const result = await runAsyncSpan(
                                                "mdx.serialize.regular",
                                                () =>
                                                    internalSerializeMdx(
                                                        content,
                                                        {
                                                            filename,
                                                            loader,
                                                            toc,
                                                            scope: {
                                                                authed: authState.authed,
                                                                user: authState.authed ? authState.user : undefined,
                                                                ...scope
                                                            },
                                                            replaceHref,
                                                            org: metadata.org,
                                                            domain: metadata.domain,
                                                            slug: options.slug
                                                        },
                                                        metadata.domain
                                                    ),
                                                {
                                                    "fern.docs.domain": domain,
                                                    "fern.docs.filename": filename ?? "unknown"
                                                }
                                            );
                                            const regularEndTime = Date.now();
                                            logger.debug(
                                                `[serializeMdx] regular serialization succeeded for domain: ${domain}, filename: ${filename || "unknown"}, duration: ${regularEndTime - regularStartTime}ms, total: ${regularEndTime - startTime}ms`
                                            );
                                            return result;
                                        }
                                    } catch (error) {
                                        cacheSpan.recordException(error as Error);
                                        logger.error(
                                            `[serializeMdx] Error serializing mdx for domain: ${domain}, filename: ${filename || "unknown"}, content length: ${content.length}`,
                                            error
                                        );
                                        logger.error(
                                            `[serializeMdx] Error stack for domain: ${domain}, filename: ${filename || "unknown"}:`,
                                            error instanceof Error ? error.stack : "No stack trace available"
                                        );

                                        // Return undefined instead of throwing so that a single failed
                                        // serialization does not take down the entire page render.
                                        return undefined;
                                    }
                                },
                                {
                                    "fern.docs.domain": domain
                                }
                            );
                        },
                        [domain, content, cacheSeed()],
                        { tags: [`${domain}:mdx`, "serializeMdx"] }
                    );

                    const result = await runAsyncSpan(
                        "mdx.serialize.cachedSerializer",
                        () =>
                            cachedSerializer({
                                ...options,
                                scope: { ...options.scope, ...scope }
                            }),
                        {
                            "fern.docs.domain": domain
                        }
                    );

                    if (result) {
                        span.setAttribute("fern.docs.mdx.engine", result.engine);
                    }

                    const endTime = Date.now();
                    logger.debug(
                        `[serializeMdx] completed for domain: ${domain}, filename: ${options.filename || "unknown"}, total duration: ${endTime - startTime}ms`
                    );

                    return result;
                },
                {
                    "fern.docs.domain": domain
                }
            );
        } finally {
            monitor.release();
        }
    };

    return cache(serializer);
}

function isPlainText(content: string): boolean {
    if (content.length === 0) {
        return true;
    }

    return /^[a-zA-Z0-9\s.,'"!?]*$/.test(content);
}

function containsInvalidAwait(code: string): boolean {
    // Check if the code contains await statements that would cause issues
    // when evaluated by new Function()
    return code.includes("await import(") || code.includes("await require(");
}
