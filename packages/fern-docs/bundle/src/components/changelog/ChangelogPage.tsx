import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { FernLink } from "@fern-docs/components/FernLink";
import { t } from "@fern-docs/i18n";
import {
    getFrontmatter,
    makeToc,
    sanitizeBreaks,
    sanitizeMdxExpression,
    type TableOfContentsItem,
    toTree
} from "@fern-docs/mdx";
import { compact } from "es-toolkit/compat";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Markdown } from "@/mdx/components/Markdown";
import { MdxContent } from "@/mdx/components/MdxContent";
import type { MdxSerializer } from "@/server/mdx-serializer";

import ChangelogPageClient from "./ChangelogPageClient";

export default async function ChangelogPage({
    loader,
    serialize,
    nodeId,
    breadcrumb,
    isFullPage,
    lang
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    nodeId: FernNavigation.NodeId;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    isFullPage: boolean;
    lang: string;
}) {
    const node = await loader.getNavigationNode(nodeId);
    const configLayout = await loader.getLayout();
    if (node.type !== "changelog") {
        console.error(`[${loader.domain}] Found non-changelog node for nodeId: ${nodeId}`);
        notFound();
    }

    const entries: FernNavigation.ChangelogEntryNode[] = [];
    FernNavigation.traverseDF(node, (n) => {
        if (n.type === "changelogEntry") {
            entries.push(n);
        }
    });
    const pageIds = entries.map((e) => e.pageId);
    const pages = (
        await Promise.all(
            compact([node.overviewPageId, ...pageIds]).map(async (pageId) => {
                const markdown = await loader.getPage(pageId);
                return {
                    pageId,
                    anchors: getAnchorIds(makeToc(toTree(markdown.markdown).hast))
                };
            })
        )
    ).filter(isNonNullish);

    const tags = new Set(entries.flatMap((e) => e.tags ?? []));
    const allTags = tags.size > 0 ? [t(lang).ui.all, ...tags] : undefined;

    /**
     * if there are duplicate anchor tags, the anchor from the first page where it appears will be used
     */
    const anchorIds: Record<string, FernNavigation.PageId> = {};
    pages.forEach(({ anchors, pageId }) => {
        anchors.forEach((anchorId) => {
            if (anchorId && !anchorIds[anchorId]) {
                anchorIds[anchorId] = pageId;
            }
        });
    });

    return (
        <ChangelogPageClient
            node={node}
            anchorIds={anchorIds}
            overview={
                <ChangelogPageOverview
                    loader={loader}
                    serialize={serialize}
                    node={node}
                    breadcrumb={breadcrumb}
                    tags={allTags}
                    lang={lang}
                />
            }
            entries={Object.fromEntries(
                entries.map((entry) => {
                    return [
                        entry.pageId,
                        <ChangelogPageEntry key={entry.pageId} loader={loader} node={entry} serialize={serialize} />
                    ] as const;
                })
            )}
            isFullPage={isFullPage}
            configLayout={configLayout}
            lang={lang}
        />
    );
}

export async function ChangelogPageOverview({
    loader,
    serialize,
    node,
    breadcrumb,
    showRssFeedButton = true,
    tags,
    showBackIcon = false,
    lang
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    node: FernNavigation.ChangelogNode;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    showRssFeedButton?: boolean;
    tags: string[] | undefined;
    showBackIcon?: boolean;
    lang: string;
}) {
    const page = node.overviewPageId != null ? await loader.getPage(node.overviewPageId) : undefined;
    const config = await loader.getConfig();
    const mdx = await serialize(page?.markdown, {
        filename: page?.filename,
        slug: node.slug
    });

    return (
        <>
            <PageHeader
                serialize={serialize}
                title={mdx?.frontmatter?.title ?? node.title}
                titleHref={slugToHref(node.slug)}
                subtitle={mdx?.frontmatter?.subtitle ?? mdx?.frontmatter?.excerpt}
                breadcrumb={breadcrumb}
                slug={node.slug}
                showRssFeedButton={showRssFeedButton}
                filters={tags}
                showBackIcon={showBackIcon}
                lang={lang}
                markdownPromise={
                    page?.markdown
                        ? Promise.resolve({ content: page.markdown, contentType: "markdown" as const })
                        : undefined
                }
                pageActionsStyle={config.theme?.["page-actions"] ?? "default"}
            />
            <Markdown mdx={mdx} fallback={page?.markdown} engine={mdx?.engine} />
        </>
    );
}

export async function ChangelogPageEntry({
    loader,
    serialize,
    node
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    node: FernNavigation.ChangelogEntryNode;
}) {
    const page = await loader.getPage(node.pageId);

    // Extract frontmatter title without full MDX bundling (much faster)
    const sanitized = sanitizeMdxExpression(sanitizeBreaks(page.markdown))[0];
    const { data: frontmatter } = getFrontmatter(sanitized);
    const frontmatterTitle = frontmatter?.title;

    // Start body serialization immediately
    const mdxPromise = serialize(page.markdown, {
        filename: page.filename,
        slug: node.slug
    });

    // If frontmatter title exists, serialize it in parallel (fast path)
    // Otherwise, wait for full MDX to run remarkExtractTitle, then serialize that title (fallback path)
    const titlePromise = frontmatterTitle
        ? serialize(frontmatterTitle, {
              filename: page.filename,
              slug: node.slug
          })
        : mdxPromise.then((mdx) => {
              const extractedTitle = mdx?.frontmatter?.title;
              return extractedTitle
                  ? serialize(extractedTitle, {
                        filename: page.filename,
                        slug: node.slug
                    })
                  : undefined;
          });

    const [mdx, title] = await Promise.all([mdxPromise, titlePromise]);

    return (
        <Markdown
            mdx={mdx}
            engine={mdx?.engine}
            title={
                title != null ? (
                    <h2>
                        <FernLink href={slugToHref(node.slug)} className="not-prose" scroll={true}>
                            <MdxContent mdx={title} engine={title?.engine} />
                        </FernLink>
                    </h2>
                ) : undefined
            }
        />
    );
}

function getAnchorIds(toc: TableOfContentsItem[]): string[] {
    return toc.flatMap((item) => {
        return [item.anchorString, ...getAnchorIds(item.children ?? [])];
    });
}
