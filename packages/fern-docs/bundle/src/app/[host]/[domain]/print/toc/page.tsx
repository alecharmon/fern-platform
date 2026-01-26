import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { PRINT_TOC_PAGE_DATA_ATTR, TOC_LINK_SENTINEL_URL_PREFIX } from "@fern-api/docs-pdf";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { getChildren, NodeCollector, slugjoin } from "@fern-api/fdr-sdk/navigation";
import type { Metadata } from "next/types";
import { Fragment } from "react";
import { getFernToken } from "@/app/fern-token";
import { runAsyncSpan } from "@/server/tracing";
import styles from "./print.module.css";
import { TocPageNumbersHydrator } from "./toc-page-numbers-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hasSlug(node: FernNavigation.NavigationNode): node is FernNavigation.NavigationNode & { slug: string } {
    return "slug" in node;
}

function hasTitle(node: FernNavigation.NavigationNode): node is FernNavigation.NavigationNode & { title: string } {
    return "title" in node;
}

function getTocNodeKey(node: FernNavigation.NavigationNode): string {
    return `${node.type}:${node.id}`;
}

function PrintTocTree({
    node,
    printableSlugSet,
    slugToPageNumber,
    depth = 0
}: {
    node: FernNavigation.NavigationNode;
    printableSlugSet: Set<string>;
    slugToPageNumber: Map<string, number>;
    depth?: number;
}): React.ReactNode {
    const slug = hasSlug(node) ? String(node.slug) : "";
    const isPrintableLeaf = printableSlugSet.has(slug);
    const title = hasTitle(node) ? node.title : undefined;
    const pageNumber = slugToPageNumber.get(slug);

    const children = getChildren(node);

    // Wrapper nodes with no title shouldn't affect visible "depth" indentation.
    const isUntitledWrapper = (title == null || title.trim().length === 0) && !isPrintableLeaf;
    const childDepth = isUntitledWrapper ? depth : depth + 1;

    const childContent = children
        .map((child) => PrintTocTree({ node: child, printableSlugSet, slugToPageNumber, depth: childDepth }))
        .filter(Boolean);

    // If neither this node nor any of its descendants are printable, skip.
    if (!isPrintableLeaf && childContent.length === 0) {
        return null;
    }

    // Some wrapper nodes in the nav tree have no title; don't render them as "Untitled".
    if (isUntitledWrapper) {
        return <Fragment key={getTocNodeKey(node)}>{childContent}</Fragment>;
    }

    // Non-leaf/group: render as a label + nested list.
    return (
        <li key={getTocNodeKey(node)} data-fern-toc-depth={depth}>
            {isPrintableLeaf ? (
                <a
                    href={`${TOC_LINK_SENTINEL_URL_PREFIX}/${encodeURIComponent(slug)}`}
                    data-fern-toc-item
                    data-fern-toc-row
                    data-fern-slug={slug}
                    className={styles.row}
                    data-fern-toc-depth={depth}
                >
                    <span data-fern-toc-title style={{ fontWeight: depth <= 2 ? 700 : 600 }}>
                        {title || "Untitled"}
                    </span>
                    <span data-fern-toc-leader aria-hidden="true" className={styles.leader} />
                    <span data-fern-toc-page data-fern-slug={slug} className={styles.pageNumber}>
                        {pageNumber ?? ""}
                    </span>
                </a>
            ) : (
                <div className={styles.groupRow} data-fern-toc-depth={depth}>
                    <span className={styles.groupTitle} style={{ fontWeight: depth <= 2 ? 700 : 600 }}>
                        {title || "Untitled"}
                    </span>
                </div>
            )}
            {childContent.length > 0 ? (
                <ol data-fern-toc-list className={styles.listNested}>
                    {childContent}
                </ol>
            ) : null}
        </li>
    );
}

export default async function PrintTocPage(props: { params: Promise<{ host: string; domain: string }> }) {
    const { host, domain } = await props.params;
    const slugToPageNumber = new Map<string, number>();

    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const [{ basePath }, lang, root] = await Promise.all([
        loader.getMetadata(),
        loader.getLanguage(),
        loader.getRoot()
    ]);

    const collector = NodeCollector.collect(root);
    const slugs = collector.indexablePageSlugs;

    const printableNodes = slugs
        .map((slug) => {
            const found = FernNavigation.utils.findNode(root, slugjoin(slug));
            if (found.type !== "found") {
                return undefined;
            }
            const slugString = String(found.node.slug);
            const node = found.node;

            // Only keep leaf nodes we know how to render in print mode.
            const isApiLeaf = FernNavigation.isApiLeaf(node);
            const pageId = FernNavigation.getPageId(node);
            if (!isApiLeaf && pageId == null) {
                return undefined;
            }
            return slugString;
        })
        .filter((x): x is string => x != null);

    const printableSlugSet = new Set(printableNodes);

    // Build TOC starting from appropriate root
    const tocRoot = root.child as unknown as FernNavigation.NavigationNode;
    const tocStartNodes = hasTitle(tocRoot) ? [tocRoot] : getChildren(tocRoot);

    return (
        <div
            {...{ [PRINT_TOC_PAGE_DATA_ATTR]: true }}
            data-fern-domain={domain}
            data-fern-base-path={basePath ?? "/"}
            lang={lang}
            className={styles.page}
        >
            <TocPageNumbersHydrator />
            <h2 className={styles.heading}>Table of Contents</h2>
            <ol data-fern-toc-list className={styles.listRoot}>
                {tocStartNodes.map((node) => (
                    <Fragment key={getTocNodeKey(node)}>
                        {PrintTocTree({ node, printableSlugSet, slugToPageNumber, depth: 0 })}
                    </Fragment>
                ))}
            </ol>
        </div>
    );
}

export async function generateMetadata(props: {
    params: Promise<{ host: string; domain: string }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.print-toc.generateMetadata", async () => {
        const { domain } = await props.params;
        return {
            title: `Table of Contents – ${domain}`,
            robots: { index: false, follow: false }
        };
    });
}
