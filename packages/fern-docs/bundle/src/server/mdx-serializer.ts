import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { Semaphore } from "es-toolkit";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { cacheSeed } from "@fern-api/docs-server/cache-seed";
import { Frontmatter } from "@fern-api/fdr-sdk/docs";

import { serializeMdx as internalSerializeMdx } from "@/mdx/bundler/serialize";
import { serializeMdxImpl as internalSerializeNextMdxRemote } from "@/mdx/bundler/serializeWithNextMdxRemote";
import { RehypeLinksOptions } from "@/mdx/plugins/rehype-links";

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
      engine: "esbuild" | "next-remote";
    }
  | undefined
>;

const monitor = new Semaphore(20);

export function createCachedMdxSerializer(
  loader: Awaited<ReturnType<typeof createCachedDocsLoader>>,
  {
    scope,
    replaceHref,
    useNextMdx,
  }: {
    scope?: Record<string, unknown>;
    replaceHref?: RehypeLinksOptions["replaceHref"];
    useNextMdx?: boolean;
  } = {}
) {
  const domain = loader.domain;
  const serializer = async (
    content: string | undefined,
    options: MdxSerializerOptions = {}
  ) => {
    if (content == null) {
      return;
    }

    if (isPlainText(content)) {
      return content;
    }

    await monitor.acquire();

    // this lets us key on just
    const cachedSerializer = unstable_cache(
      async ({ filename, toc, scope }: MdxSerializerOptions) => {
        const authState = await loader.getAuthState();

        try {
          if (useNextMdx && !content.includes("twoslash")) {
            try {
              const result = await internalSerializeNextMdxRemote(content, {
                loader,
                scope: {
                  authed: authState.authed,
                  user: authState.authed ? authState.user : undefined,
                  ...scope,
                },
                replaceHref,
              });

              if (result && containsInvalidAwait(result.code)) {
                throw new Error(
                  "NextMdxRemote generated invalid code with await statements, trying regular MDX serialization"
                );
              }

              return result;
            } catch (_nextMdxError) {
              try {
                const result = await internalSerializeMdx(content, {
                  filename,
                  loader,
                  toc,
                  scope: {
                    authed: authState.authed,
                    user: authState.authed ? authState.user : undefined,
                    ...scope,
                  },
                  replaceHref,
                });
                return result;
              } catch (fallbackError) {
                console.error(
                  "Both engines failed serializing mdx",
                  fallbackError
                );

                return undefined;
              }
            }
          } else {
            const result = await internalSerializeMdx(content, {
              filename,
              loader,
              toc,
              scope: {
                authed: authState.authed,
                user: authState.authed ? authState.user : undefined,
                ...scope,
              },
              replaceHref,
            });
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
        scope: { ...options.scope, ...scope },
      });

      // if the result is undefined, we need to revalidate the cache
      // NOTE: you cannot do this because you cant revalidate the cache in a render function
      // if (result == null) {
      //   revalidateTag(key);
      // }

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
