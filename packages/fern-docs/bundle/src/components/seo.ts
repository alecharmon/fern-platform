import { createCachedDocsLoader, createPruneKey } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl, getSeoDisabled } from "@fern-docs/edge-config";
import { getFrontmatter, markdownToString } from "@fern-docs/mdx";
import type { Metadata } from "next";

import { toImageDescriptor } from "@/app/seo";
import { createFindNode } from "@/server/find-node";
import { runAsyncSpan } from "@/server/tracing";

import { truncateDescription } from "./util/truncateDescription";

export { truncateDescription };

type DocsPage = Awaited<ReturnType<DocsLoader["getPage"]>>;

/**
 * Gets the description from an API definition node (endpoint, webhook, or websocket).
 * Returns undefined if the node is not an API leaf or if no description is available.
 */
async function getApiDescriptionFromNode(
    node: FernNavigation.NavigationNode | undefined,
    loader: DocsLoader
): Promise<string | undefined> {
    if (node == null || !FernNavigation.isApiLeaf(node)) {
        return undefined;
    }

    try {
        const apiDefinition = await loader.getPrunedApi(node.apiDefinitionId, createPruneKey(node));
        if (apiDefinition == null) {
            return undefined;
        }

        if (node.type === "endpoint") {
            const endpoint = apiDefinition.endpoints[node.endpointId];
            return typeof endpoint?.description === "string" ? endpoint.description : undefined;
        }

        if (node.type === "webhook") {
            const webhook = apiDefinition.webhooks[node.webhookId];
            return typeof webhook?.description === "string" ? webhook.description : undefined;
        }

        if (node.type === "webSocket") {
            const websocket = apiDefinition.websockets[node.webSocketId];
            return typeof websocket?.description === "string" ? websocket.description : undefined;
        }
    } catch (error) {
        // If we fail to fetch the API definition, fall back to undefined
        console.error("Failed to fetch API definition for description:", error);
        return undefined;
    }

    return undefined;
}

export async function getMetadataTitleFromPage({
    loader,
    slug,
    page: prefetchedPage
}: {
    loader: DocsLoader;
    slug: Slug;
    page?: DocsPage;
}): Promise<string | undefined> {
    const slugAttr = slugToAttribute(slug);
    const findNode = createFindNode(loader);

    return runAsyncSpan(
        "metadata.getTitleFromPage",
        async () => {
            const node = await runAsyncSpan("metadata.title.findNode", () => findNode(slug), {
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });

            const pageId = node != null ? FernNavigation.getPageId(node) : undefined;
            const page =
                prefetchedPage ??
                (pageId
                    ? await runAsyncSpan("metadata.title.getPage", () => loader.getPage(pageId), {
                          "fern.docs.pageId": pageId,
                          "fern.docs.domain": loader.domain
                      })
                    : undefined);
            const frontmatter = page ? getFrontmatter(page.markdown)?.data : undefined;

            return markdownToString(frontmatter?.headline || frontmatter?.title || node?.title) ?? node?.title;
        },
        {
            "fern.docs.domain": loader.domain,
            "fern.docs.slug": slugAttr
        }
    );
}

export async function generateMetadataFromPage({
    loader,
    slug
}: {
    loader: DocsLoader;
    slug: Slug;
}): Promise<Metadata> {
    const slugAttr = slugToAttribute(slug);
    const findNode = createFindNode(loader);

    return runAsyncSpan(
        "metadata.generateFromPage",
        async () => {
            const [files, node, config, isSeoDisabled] = await Promise.all([
                runAsyncSpan("metadata.loader.getFiles", () => loader.getFiles(), {
                    "fern.docs.domain": loader.domain
                }),
                runAsyncSpan("metadata.findNode", () => findNode(slug), {
                    "fern.docs.domain": loader.domain,
                    "fern.docs.slug": slugAttr
                }),
                runAsyncSpan("metadata.loader.getConfig", () => loader.getConfig(), {
                    "fern.docs.domain": loader.domain
                }),
                runAsyncSpan("metadata.edge.getSeoDisabled", () => getSeoDisabled(loader.domain), {
                    "fern.docs.domain": loader.domain
                })
            ]);

            const pageId = node != null ? FernNavigation.getPageId(node) : undefined;
            const page = pageId
                ? await runAsyncSpan("metadata.loader.getPage", () => loader.getPage(pageId), {
                      "fern.docs.pageId": pageId,
                      "fern.docs.domain": loader.domain
                  })
                : undefined;
            const frontmatter = page ? getFrontmatter(page.markdown)?.data : undefined;

            const noindex =
                node == null ||
                (FernNavigation.hasMarkdown(node) && node.noindex) ||
                node.hidden ||
                isSeoDisabled ||
                frontmatter?.noindex ||
                false;
            const nofollow = node?.hidden || isSeoDisabled || frontmatter?.nofollow || false;

            const canonicalHost =
                config.metadata?.canonicalHost ??
                (await runAsyncSpan("metadata.getCanonicalUrl", () => getCanonicalUrl(loader.domain), {
                    "fern.docs.domain": loader.domain
                }));
            const baseUrl = withDefaultProtocol(canonicalHost ?? loader.domain);

            let canonicalUrl: string | undefined;

            if (frontmatter?.["canonical-url"]) {
                canonicalUrl = frontmatter["canonical-url"];
            } else if (node != null) {
                canonicalUrl = `${baseUrl}${slugToHref(node.canonicalSlug ?? node.slug)}`;
            } else if (canonicalHost) {
                canonicalUrl = baseUrl;
            }

            const frontmatterDescription = markdownToString(
                frontmatter?.description || frontmatter?.subtitle || frontmatter?.excerpt
            );

            let description = frontmatterDescription;
            if (!description && node != null) {
                const descriptionSrc = await getApiDescriptionFromNode(node, loader);
                description = truncateDescription(descriptionSrc);
            }

            const title = await runAsyncSpan(
                "metadata.computeTitle",
                () => getMetadataTitleFromPage({ loader, slug, page }),
                {
                    "fern.docs.domain": loader.domain,
                    "fern.docs.slug": slugAttr
                }
            );

            return {
                title,
                description,
                keywords: frontmatter?.keywords,
                robots: {
                    index: noindex ? false : undefined,
                    follow: nofollow ? false : undefined
                },
                alternates: {
                    canonical: canonicalUrl
                },
                openGraph: {
                    title: frontmatter?.["og:title"] ?? config.metadata?.["og:title"],
                    description: frontmatter?.["og:description"] ?? config.metadata?.["og:description"],
                    locale: frontmatter?.["og:locale"] ?? config.metadata?.["og:locale"],
                    url: frontmatter?.["og:url"] ?? config.metadata?.["og:url"],
                    siteName: frontmatter?.["og:site_name"] ?? config.metadata?.["og:site_name"],
                    images: resolveOgImages(files, frontmatter, config, loader.domain, slug)
                },
                twitter: {
                    card: frontmatter?.["twitter:card"] ?? config.metadata?.["twitter:card"] ?? "summary_large_image",
                    site: frontmatter?.["twitter:site"] ?? config.metadata?.["twitter:site"],
                    creator: frontmatter?.["twitter:handle"] ?? config.metadata?.["twitter:handle"],
                    title: frontmatter?.["twitter:title"] ?? config.metadata?.["twitter:title"],
                    description: frontmatter?.["twitter:description"] ?? config.metadata?.["twitter:description"],
                    images: resolveTwitterImages(files, frontmatter, config, loader.domain, slug)
                },
                icons: {
                    icon: config.favicon
                        ? toImageDescriptor(files, {
                              type: "fileId",
                              value: config.favicon
                          })?.url
                        : undefined
                }
            };
        },
        {
            "fern.docs.domain": loader.domain,
            "fern.docs.slug": slugAttr
        }
    );
}

export async function generateMetadataFromConfig(props: {
    params: Promise<{ host: string; domain: string }>;
}): Promise<Metadata> {
    return runAsyncSpan(
        "metadata.generateFromConfig",
        async (span) => {
            const { host, domain } = await props.params;
            span.setAttributes({
                "fern.docs.host": host,
                "fern.docs.domain": domain
            });

            const loader = await runAsyncSpan("metadata.loader.create", () => createCachedDocsLoader(host, domain), {
                "fern.docs.domain": domain
            });
            const [files, config, seoDisabled] = await Promise.all([
                runAsyncSpan("metadata.loader.getFiles", () => loader.getFiles(), {
                    "fern.docs.domain": loader.domain
                }),
                runAsyncSpan("metadata.loader.getConfig", () => loader.getConfig(), {
                    "fern.docs.domain": loader.domain
                }),
                runAsyncSpan("metadata.edge.getSeoDisabled", () => getSeoDisabled(domain), {
                    "fern.docs.domain": loader.domain
                })
            ]);

            const index = config.metadata?.noindex || seoDisabled ? false : undefined;
            const follow = config.metadata?.nofollow || seoDisabled ? false : undefined;

            const canonicalUrl = await runAsyncSpan("metadata.getCanonicalUrl", () => getCanonicalUrl(domain), {
                "fern.docs.domain": domain
            });

            return {
                metadataBase: canonicalUrl ? new URL(withDefaultProtocol(canonicalUrl)) : undefined,
                applicationName: config.title,
                title: {
                    template: config.title ? "%s | " + config.title : "%s",
                    default: "Documentation"
                },
                robots: { index, follow },
                openGraph: {
                    title: config.metadata?.["og:title"],
                    description: config.metadata?.["og:description"],
                    locale: config.metadata?.["og:locale"],
                    url: config.metadata?.["og:url"],
                    siteName: config.metadata?.["og:site_name"],
                    images: toImageDescriptor(
                        files,
                        config.metadata?.["og:image"],
                        config.metadata?.["og:image:width"],
                        config.metadata?.["og:image:height"]
                    )
                },
                twitter: {
                    card: config.metadata?.["twitter:card"],
                    site: config.metadata?.["twitter:site"],
                    creator: config.metadata?.["twitter:handle"],
                    title: config.metadata?.["twitter:title"],
                    description: config.metadata?.["twitter:description"],
                    images: toImageDescriptor(files, config.metadata?.["twitter:image"])
                },
                icons: {
                    icon: config.favicon
                        ? toImageDescriptor(files, {
                              type: "fileId",
                              value: config.favicon
                          })?.url
                        : undefined
                }
            };
        },
        undefined
    );
}

function resolveOgImages(
    files: Record<string, { src: string }>,
    frontmatter: Record<string, unknown> | null | undefined,
    config: { metadata?: Record<string, unknown> },
    domain: string,
    slug: Slug
) {
    const useDynamic = config.metadata?.["og:dynamic"] === true;

    // Per-page frontmatter always wins
    const fromFrontmatter =
        toImageDescriptor(
            files,
            frontmatter?.["og:image"] as Parameters<typeof toImageDescriptor>[1],
            frontmatter?.["og:image:width"] as number | undefined,
            frontmatter?.["og:image:height"] as number | undefined
        ) ?? toImageDescriptor(files, frontmatter?.image as Parameters<typeof toImageDescriptor>[1]);

    if (fromFrontmatter) {
        return fromFrontmatter;
    }

    const globalOgImage = toImageDescriptor(
        files,
        config.metadata?.["og:image"] as Parameters<typeof toImageDescriptor>[1],
        config.metadata?.["og:image:width"] as number | undefined,
        config.metadata?.["og:image:height"] as number | undefined
    );

    // When og:dynamic is enabled, use dynamic OG for all pages
    // except: if a global og:image is set, use it for the homepage
    if (useDynamic) {
        const isHomepage = isRootSlug(slug);
        if (isHomepage && globalOgImage) {
            return globalOgImage;
        }
        return buildDynamicOgImageDescriptor(domain, slug);
    }

    // Otherwise fall back to global config only
    return globalOgImage;
}

function resolveTwitterImages(
    files: Record<string, { src: string }>,
    frontmatter: Record<string, unknown> | null | undefined,
    config: { metadata?: Record<string, unknown> },
    domain: string,
    slug: Slug
) {
    const useDynamic = config.metadata?.["og:dynamic"] === true;

    const fromFrontmatter = toImageDescriptor(
        files,
        frontmatter?.["twitter:image"] as Parameters<typeof toImageDescriptor>[1]
    );

    if (fromFrontmatter) {
        return fromFrontmatter;
    }

    const globalTwitterImage = toImageDescriptor(
        files,
        config.metadata?.["twitter:image"] as Parameters<typeof toImageDescriptor>[1]
    );

    if (useDynamic) {
        const isHomepage = isRootSlug(slug);
        if (isHomepage && globalTwitterImage) {
            return globalTwitterImage;
        }
        return buildDynamicOgImageDescriptor(domain, slug);
    }

    return globalTwitterImage;
}

function buildDynamicOgImageDescriptor(domain: string, slug: Slug): { url: string; width: number; height: number } {
    const slugStr = (Array.isArray(slug) ? slug.join("/") : slug).split("#")[0] ?? "";
    return {
        url: `https://${domain}/api/fern-docs/og?slug=${encodeURIComponent(slugStr)}`,
        width: 1200,
        height: 630
    };
}

function isRootSlug(slug: Slug): boolean {
    const str = Array.isArray(slug) ? slug.join("/") : slug;
    return str === "" || str === "/";
}

function slugToAttribute(slug: Slug): string {
    return Array.isArray(slug) ? slug.join("/") : slug;
}
