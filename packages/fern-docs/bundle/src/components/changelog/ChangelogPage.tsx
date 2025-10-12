import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { FernLink } from "@fern-docs/components/FernLink";
import { makeToc, type TableOfContentsItem, toTree } from "@fern-docs/mdx";
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
    isFullPage
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    nodeId: FernNavigation.NodeId;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    isFullPage: boolean;
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
    const allTags = tags.size > 0 ? ["All", ...tags] : undefined;

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
        />
    );
}

export async function ChangelogPageOverview({
    loader,
    serialize,
    node,
    breadcrumb,
    showRssFeedButton = true,
    tags
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    node: FernNavigation.ChangelogNode;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    showRssFeedButton?: boolean;
    tags: string[] | undefined;
}) {
    const page = node.overviewPageId != null ? await loader.getPage(node.overviewPageId) : undefined;
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
            />
            <Markdown mdx={mdx} fallback={page?.markdown} useNextMdx={mdx?.engine === "next-remote"} />
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
    const mdx = await serialize(page.markdown, {
        filename: page.filename,
        slug: node.slug
    });

    const title = await serialize(mdx?.frontmatter?.title, {
        filename: page.filename,
        slug: node.slug
    });

    return (
        <Markdown
            mdx={mdx}
            useNextMdx={mdx?.engine === "next-remote"}
            title={
                title != null ? (
                    <h2>
                        <FernLink href={slugToHref(node.slug)} className="not-prose" scroll={true}>
                            <MdxContent mdx={title} useNextMdx={mdx?.engine === "next-remote"} />
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
