"use client";

import { slugToHref } from "@fern-api/docs-utils";
import type { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { EMPTY_ARRAY } from "@fern-api/ui-core-utils";
import { ChangelogContentLayout } from "@fern-docs/components/changelog/ChangelogContentLayout";
import { ChangelogEntryLabel } from "@fern-docs/components/changelog/ChangelogEntryLabel";
import { flattenChangelogEntries } from "@fern-docs/components/changelog/flattenChangelogEntries";
import { FernLink } from "@fern-docs/components/FernLink";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";
import { AsideAwareDiv } from "@fern-docs/components/layouts/AsideAwareDiv";
import { TableOfContentsLayout } from "@fern-docs/components/layouts/TableOfContentsLayout";
import { SetLayout } from "@fern-docs/components/state/layout";
import { SCROLL_BODY_ATOM } from "@fern-docs/components/state/viewport";
import { t } from "@fern-docs/i18n";
import type { TableOfContentsItem } from "@fern-docs/mdx";
import { useIsomorphicLayoutEffect } from "@fern-ui/react-commons";
import { chunk } from "es-toolkit/array";
import { useAtomValue } from "jotai";
import React, { Fragment, type ReactElement, useEffect, useMemo } from "react";
import { HideBuiltWithFern } from "@/components/built-with-fern";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { useSelectedFilters } from "@/state/search";
import { BottomNavigationClient } from "../bottom-nav-client";
import { PageFilters } from "../PageFilters";

const CHANGELOG_PAGE_SIZE = 10;

export default function ChangelogPageClient({
    node,
    anchorIds,
    entryTocs,
    overview,
    entries,
    isFullPage,
    configLayout,
    lang
}: {
    node: FernNavigation.ChangelogNode;
    anchorIds: Record<string, FernNavigation.PageId>;
    entryTocs: Record<string, TableOfContentsItem[]>;
    overview: React.ReactNode;
    entries: Record<string, React.ReactNode>;
    isFullPage: boolean;
    configLayout: FernLayoutConfig;
    lang: string;
}): ReactElement<any> {
    const selectedFilters = useSelectedFilters();
    const flattenedEntries = useMemo(() => flattenChangelogEntries({ node, selectedFilters }), [node, selectedFilters]);
    const chunkedEntries = useMemo(() => chunk(flattenedEntries, CHANGELOG_PAGE_SIZE), [flattenedEntries]);
    const [page, setPage] = React.useState(1);

    const currentAnchor = useCurrentAnchor();

    // Build hierarchical TOC: dates as parents, version numbers (from markdown headings) as children
    const tableOfContents: TableOfContentsItem[] = useMemo(() => {
        const visibleOnCurrentPage = chunkedEntries[page - 1] ?? [];

        // Group entries by normalized date (YYYY-MM-DD format for consistent grouping)
        const entriesByDate = new Map<
            string,
            { entries: FernNavigation.ChangelogEntryNode[]; firstEntryDate: string }
        >();
        visibleOnCurrentPage.forEach((entry) => {
            // Normalize date to YYYY-MM-DD for grouping (use UTC to avoid timezone issues)
            const dateObj = new Date(entry.date);
            const normalizedDate = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`;

            const existing = entriesByDate.get(normalizedDate);
            if (existing) {
                existing.entries.push(entry);
            } else {
                entriesByDate.set(normalizedDate, { entries: [entry], firstEntryDate: entry.date });
            }
        });

        // Build TOC items with dates as parents and version numbers as children
        const tocItems: TableOfContentsItem[] = [];
        entriesByDate.forEach(({ entries: dateEntries, firstEntryDate }) => {
            // Format the date for display (e.g., "January 12, 2026") using UTC to avoid timezone issues
            const formattedDate = new Date(firstEntryDate).toLocaleDateString(lang, {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC"
            });

            // Get version numbers from markdown headings for each entry
            const children: TableOfContentsItem[] = dateEntries.flatMap((entry) => {
                const toc = entryTocs[entry.pageId] ?? [];
                // Use the first heading from each entry's markdown as the version number
                // If no headings, fall back to using the entry date as anchor
                if (toc.length > 0) {
                    return toc.map((item) => ({
                        simpleString: item.simpleString,
                        anchorString: item.anchorString,
                        children: []
                    }));
                }
                return [];
            });

            // Only add the date group if there are children (version numbers)
            if (children.length > 0) {
                tocItems.push({
                    simpleString: formattedDate,
                    anchorString: firstEntryDate,
                    children
                });
            }
        });

        return tocItems;
    }, [chunkedEntries, page, lang, entryTocs]);

    useIsomorphicLayoutEffect(() => {
        const getPageFromHash = (): number => {
            if (!currentAnchor) {
                return 1;
            }

            /**
             * if the hash appears on an entry, navigate to page where the entry is located
             */
            const entryPageId = anchorIds[currentAnchor];
            if (entryPageId != null) {
                const entry = flattenedEntries.findIndex((entry) => entry.pageId === entryPageId);
                if (entry !== -1) {
                    return Math.floor(entry / CHANGELOG_PAGE_SIZE) + 1;
                }
            }

            const match = currentAnchor.match(/^page-(\d+)$/)?.[1];
            if (match == null) {
                return 1;
            }
            /**
             * Ensure the page number is within the bounds of the changelog entries
             */
            return Math.min(Math.max(parseInt(match, 10), 1), chunkedEntries.length);
        };

        setPage(getPageFromHash());
    }, [currentAnchor]);

    /**
     * Scroll to the top of the page when navigating to a new page of the changelog
     */
    const scrollBody = useAtomValue(SCROLL_BODY_ATOM);
    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when page changes
    useEffect(() => {
        const element = document.getElementById(window.location.hash.slice(1));

        if (element != null) {
            element.scrollIntoView();
            return;
        }

        if (scrollBody instanceof Document) {
            window.scrollTo(0, 0);
        } else {
            scrollBody?.scrollTo(0, 0);
        }
    }, [page]);

    const visibleEntries = chunkedEntries[page - 1] ?? EMPTY_ARRAY;

    const prev = useMemo(() => {
        if (page === 1) {
            return undefined;
        }

        return {
            href: `#page-${page - 1}`,
            shallow: true,
            onClick: () => {
                setPage(page - 1);
                window.scrollTo(0, 0);
            }
        };
    }, [page]);

    const next = useMemo(() => {
        if (page >= chunkedEntries.length) {
            return undefined;
        }

        return {
            title: t(lang).navigation.olderPosts,
            href: `#page-${page + 1}`,
            shallow: true,
            onClick: () => {
                setPage(page + 1);
                window.scrollTo(0, 0);
            }
        };
    }, [chunkedEntries.length, page, lang]);

    return (
        <>
            <TableOfContentsLayout tableOfContents={tableOfContents} hideTableOfContents={false} lang={lang} />
            <AsideAwareDiv className="fern-layout-changelog" isFullPage={isFullPage} preserveToc>
                <article className="fern-layout-page">
                    <SetLayout value="guide" />
                    <HideBuiltWithFern>
                        <ChangelogContentLayout as="section">{overview}</ChangelogContentLayout>

                        {visibleEntries.map((entry, i) => {
                            return (
                                <Fragment key={entry.id}>
                                    <ChangelogContentLayout
                                        className={i === 0 ? "mt-8" : "mt-16"}
                                        as="article"
                                        id={entry.date}
                                        stickyContent={
                                            <ChangelogEntryLabel
                                                asChild
                                                title={
                                                    <FernLink href={slugToHref(entry.slug)} scroll={true}>
                                                        {entry.title}
                                                    </FernLink>
                                                }
                                                tags={
                                                    <PageFilters
                                                        filters={entry.tags ?? []}
                                                        forcePillDisplay
                                                        lang={lang}
                                                    />
                                                }
                                            />
                                        }
                                    >
                                        {entries[entry.pageId]}
                                    </ChangelogContentLayout>
                                    {i < visibleEntries.length - 1 && <hr className="my-4" />}
                                </Fragment>
                            );
                        })}
                    </HideBuiltWithFern>
                    <div className="grow" />
                    <FooterLayout
                        hideFeedback
                        bottomNavigation={
                            configLayout.hideNavLinks ? undefined : (
                                <BottomNavigationClient prev={prev} next={next} lang={lang} />
                            )
                        }
                        lang={lang}
                    />
                </article>
            </AsideAwareDiv>
        </>
    );
}
