import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { FernLink } from "@fern-docs/components/FernLink";
import { t } from "@fern-docs/i18n";
import { getFrontmatter, makeToc, type TableOfContentsItem, toTree } from "@fern-docs/mdx";
import { compact } from "es-toolkit/compat";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Markdown } from "@/mdx/components/Markdown";
import { MdxContent } from "@/mdx/components/MdxContent";
import { filterMarkdownContent } from "@/server/getMarkdownForPath";
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
        logger.error(`[${loader.domain}] Found non-changelog node for nodeId: ${nodeId}`);
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
                const strippedContent = getFrontmatter(markdown.markdown).content;
                const toc = makeToc(toTree(strippedContent).hast);
                return {
                    pageId,
                    anchors: getAnchorIds(toc),
                    toc
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

    // Build entryTocs mapping pageId to TOC items (headings from markdown)
    const entryTocs: Record<string, TableOfContentsItem[]> = {};
    pages.forEach(({ pageId, toc }) => {
        entryTocs[pageId] = toc;
    });

    return (
        <ChangelogPageClient
            node={node}
            anchorIds={anchorIds}
            entryTocs={entryTocs}
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

    const authState = await loader.getAuthState();
    const userRoles = authState.authed ? (authState.user.roles ?? []) : [];
    const filteredMarkdown =
        page?.markdown != null && node.overviewPageId != null
            ? filterMarkdownContent(page.markdown, node.overviewPageId, userRoles)
            : undefined;

    const title = mdx?.frontmatter?.title ?? node.title;

    return (
        <>
            <PageHeader
                serialize={serialize}
                title={title}
                titleHref={slugToHref(node.slug)}
                subtitle={mdx?.frontmatter?.subtitle ?? mdx?.frontmatter?.excerpt}
                breadcrumb={breadcrumb}
                slug={node.slug}
                showRssFeedButton={showRssFeedButton}
                filters={tags}
                showBackIcon={showBackIcon}
                lang={lang}
                markdownPromise={filteredMarkdown != null ? Promise.resolve(filteredMarkdown) : undefined}
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
