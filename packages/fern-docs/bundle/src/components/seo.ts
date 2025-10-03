import { Metadata } from "next";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { Slug } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getCanonicalUrl } from "@fern-docs/edge-config";
import { getSeoDisabled } from "@fern-docs/edge-config";
import { getFrontmatter, markdownToString } from "@fern-docs/mdx";

import { toImageDescriptor } from "@/app/seo";
import { createFindNode } from "@/server/find-node";

export async function getMetadataTitleFromPage({
    loader,
    slug
}: {
    loader: DocsLoader;
    slug: Slug;
}): Promise<string | undefined> {
    const findNode = createFindNode(loader);
    const node = await findNode(slug);

    const pageId = node != null ? FernNavigation.getPageId(node) : undefined;
    const page = pageId ? await loader.getPage(pageId) : undefined;
    const frontmatter = page ? getFrontmatter(page.markdown)?.data : undefined;

    const title = markdownToString(frontmatter?.headline || frontmatter?.title || node?.title) ?? node?.title;

    return title;
}

export async function generateMetadataFromPage({
    loader,
    slug
}: {
    loader: DocsLoader;
    slug: Slug;
}): Promise<Metadata> {
    const findNode = createFindNode(loader);
    const [files, node, config, isSeoDisabled] = await Promise.all([
        loader.getFiles(),
        findNode(slug),
        loader.getConfig(),
        getSeoDisabled(loader.domain)
    ]);

    const pageId = node != null ? FernNavigation.getPageId(node) : undefined;
    const page = pageId ? await loader.getPage(pageId) : undefined;
    const frontmatter = page ? getFrontmatter(page.markdown)?.data : undefined;

    const noindex =
        node == null ||
        (FernNavigation.hasMarkdown(node) && node.noindex) ||
        node.hidden ||
        isSeoDisabled ||
        frontmatter?.noindex ||
        false;
    const nofollow = node?.hidden || isSeoDisabled || frontmatter?.nofollow || false;

    const canonicalHost = await getCanonicalUrl(loader.domain);
    const baseUrl = withDefaultProtocol(canonicalHost ?? loader.domain);

    let canonicalUrl: string | undefined;

    if (frontmatter?.["canonical-url"]) {
        canonicalUrl = frontmatter["canonical-url"];
    } else if (node != null) {
        canonicalUrl = `${baseUrl}${slugToHref(node.canonicalSlug ?? node.slug)}`;
    } else if (canonicalHost) {
        canonicalUrl = baseUrl;
    }

    const title = await getMetadataTitleFromPage({ loader, slug });
    return {
        title,
        description: markdownToString(frontmatter?.description || frontmatter?.subtitle || frontmatter?.excerpt),
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
            images:
                toImageDescriptor(
                    files,
                    frontmatter?.["og:image"],
                    frontmatter?.["og:image:width"],
                    frontmatter?.["og:image:height"]
                ) ??
                toImageDescriptor(files, frontmatter?.image) ??
                toImageDescriptor(
                    files,
                    config.metadata?.["og:image"],
                    config.metadata?.["og:image:width"],
                    config.metadata?.["og:image:height"]
                )
        },
        twitter: {
            site: frontmatter?.["twitter:site"] ?? config.metadata?.["twitter:site"],
            creator: frontmatter?.["twitter:handle"] ?? config.metadata?.["twitter:handle"],
            title: frontmatter?.["twitter:title"] ?? config.metadata?.["twitter:title"],
            description: frontmatter?.["twitter:description"] ?? config.metadata?.["twitter:description"],
            images:
                toImageDescriptor(files, frontmatter?.["twitter:image"]) ??
                toImageDescriptor(files, config.metadata?.["twitter:image"])
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
}

export async function generateMetadataFromConfig(props: {
    params: Promise<{ host: string; domain: string }>;
}): Promise<Metadata> {
    const { host, domain } = await props.params;

    const loader = await createCachedDocsLoader(host, domain);
    const [files, config, seoDisabled] = await Promise.all([
        loader.getFiles(),
        loader.getConfig(),
        getSeoDisabled(domain)
    ]);

    const index = config.metadata?.noindex || seoDisabled ? false : undefined;
    const follow = config.metadata?.nofollow || seoDisabled ? false : undefined;

    const canonicalUrl = await getCanonicalUrl(domain);

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
}
