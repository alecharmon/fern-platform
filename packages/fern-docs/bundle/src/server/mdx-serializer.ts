import "server-only";

import type { CachedDocsLoader } from "@fern-api/docs-loader";
import { cacheSeed } from "@fern-api/docs-server/cache-seed";
import type { Frontmatter } from "@fern-api/fdr-sdk/docs";
import { Semaphore } from "es-toolkit";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { serializeMdx as internalSerializeMdx } from "@/mdx/bundler/serialize";
import { serializeMdxImpl as internalSerializeNextMdxRemote } from "@/mdx/bundler/serializeWithNextMdxRemote";
import type { RehypeLinksOptions } from "@/mdx/plugins/rehype-links";

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

        const startTime = Date.now();
        console.log(
            `[serializeMdx] starting serialization for domain: ${domain}, filename: ${options.filename || "unknown"}`
        );

        // this lets us key on just
        const cachedSerializer = unstable_cache(
            async ({ filename, toc, scope }: MdxSerializerOptions) => {
                const cacheStartTime = Date.now();
                console.log(
                    `[serializeMdx] inside cache function for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${cacheStartTime - startTime}ms`
                );
                const [authState, metadata] = await Promise.all([loader.getAuthState(), loader.getMetadata()]);

                try {
                    if (useNextMdx && !content.includes("twoslash")) {
                        try {
                            const nextMdxStartTime = Date.now();
                            console.log(
                                `[serializeMdx] using NextMdxRemote for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${nextMdxStartTime - startTime}ms`
                            );
                            const result = await internalSerializeNextMdxRemote(content, {
                                loader,
                                scope: {
                                    authed: authState.authed,
                                    user: authState.authed ? authState.user : undefined,
                                    ...scope
                                },
                                replaceHref
                            });

                            if (result && containsInvalidAwait(result.code)) {
                                throw new Error(
                                    "NextMdxRemote generated invalid code with await statements, trying regular MDX serialization"
                                );
                            }

                            const nextMdxEndTime = Date.now();
                            console.log(
                                `[serializeMdx] NextMdxRemote succeeded for domain: ${domain}, filename: ${filename || "unknown"}, duration: ${nextMdxEndTime - nextMdxStartTime}ms, total: ${nextMdxEndTime - startTime}ms`
                            );
                            return result;
                        } catch (_nextMdxError) {
                            try {
                                const fallbackStartTime = Date.now();
                                console.log(
                                    `[serializeMdx] NextMdxRemote failed, falling back to regular serialization for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${fallbackStartTime - startTime}ms`
                                );
                                const result = await internalSerializeMdx(content, {
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
                                    domain: metadata.domain
                                });
                                const fallbackEndTime = Date.now();
                                console.log(
                                    `[serializeMdx] fallback serialization succeeded for domain: ${domain}, filename: ${filename || "unknown"}, duration: ${fallbackEndTime - fallbackStartTime}ms, total: ${fallbackEndTime - startTime}ms`
                                );
                                return result;
                            } catch (fallbackError) {
                                console.error("[serializeMdx] Both engines failed serializing mdx", fallbackError);

                                return undefined;
                            }
                        }
                    } else {
                        const regularStartTime = Date.now();
                        console.log(
                            `[serializeMdx] using regular serialization for domain: ${domain}, filename: ${filename || "unknown"}, time since start: ${regularStartTime - startTime}ms`
                        );
                        const result = await internalSerializeMdx(content, {
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
                            domain: metadata.domain
                        });
                        const regularEndTime = Date.now();
                        console.log(
                            `[serializeMdx] regular serialization succeeded for domain: ${domain}, filename: ${filename || "unknown"}, duration: ${regularEndTime - regularStartTime}ms, total: ${regularEndTime - startTime}ms`
                        );
                        return result;
                    }
                } catch (error) {
                    console.error("Error serializing mdx", error);

                    // Instead of returning raw content, throw the error to be handled by the caller
                    throw error;
                }
            },
            [domain, content, cacheSeed()],
            { tags: [domain, "serializeMdx"] }
        );

        try {
            // merge the scope from the page with the scope from the serializer
            const result = await cachedSerializer({
                ...options,
                scope: { ...options.scope, ...scope }
            });

            // if the result is undefined, we need to revalidate the cache
            // NOTE: you cannot do this because you cant revalidate the cache in a render function
            // if (result == null) {
            //   revalidateTag(key);
            // }

            const endTime = Date.now();
            console.log(
                `[serializeMdx] completed for domain: ${domain}, filename: ${options.filename || "unknown"}, total duration: ${endTime - startTime}ms`
            );

            return result;
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
