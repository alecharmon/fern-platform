"use client";

import React, { Fragment, ReactElement, useEffect, useMemo } from "react";

import { chunk } from "es-toolkit/array";
import { useAtomValue } from "jotai";

import { slugToHref } from "@fern-api/docs-utils";
import { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { EMPTY_ARRAY } from "@fern-api/ui-core-utils";
import { Badge } from "@fern-docs/components/badges";
import { FernLink } from "@fern-docs/components/FernLink";
import { useCurrentAnchor } from "@fern-docs/components/hooks/use-anchor";
import { AsideAwareDiv } from "@fern-docs/components/layouts/AsideAwareDiv";
import { TableOfContentsLayout } from "@fern-docs/components/layouts/TableOfContentsLayout";
import { SetLayout } from "@fern-docs/components/state/layout";
import { SCROLL_BODY_ATOM } from "@fern-docs/components/state/viewport";
import { useIsomorphicLayoutEffect } from "@fern-ui/react-commons";

import { HideBuiltWithFern } from "@/components/built-with-fern";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { useSelectedFilters } from "@/state/search";

import { PageFilters } from "../PageFilters";
import { BottomNavigationClient } from "../bottom-nav-client";
import { ChangelogContentLayout } from "./ChangelogContentLayout";

function flattenChangelogEntries({
    node,
    selectedFilters
}: {
    node: FernNavigation.ChangelogNode;
    selectedFilters: string[];
}): FernNavigation.ChangelogEntryNode[] {
    return node.children.flatMap((year) =>
        year.children
            .flatMap((month) => month.children)
            .filter((entry) => selectedFilters.length === 0 || entry.tags?.some((tag) => selectedFilters.includes(tag)))
    );
}

const CHANGELOG_PAGE_SIZE = 10;

export default function ChangelogPageClient({
    node,
    anchorIds,
    overview,
    entries,
    isFullPage,
    configLayout
}: {
    node: FernNavigation.ChangelogNode;
    anchorIds: Record<string, FernNavigation.PageId>;
    overview: React.ReactNode;
    entries: Record<string, React.ReactNode>;
    isFullPage: boolean;
    configLayout: FernLayoutConfig;
}): ReactElement<any> {
    const selectedFilters = useSelectedFilters();
    const flattenedEntries = useMemo(() => flattenChangelogEntries({ node, selectedFilters }), [node, selectedFilters]);
    const chunkedEntries = useMemo(() => chunk(flattenedEntries, CHANGELOG_PAGE_SIZE), [flattenedEntries]);
    const [page, setPage] = React.useState(1);

    const currentAnchor = useCurrentAnchor();

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            title: "Older posts",
            href: `#page-${page + 1}`,
            shallow: true,
            onClick: () => {
                setPage(page + 1);
                window.scrollTo(0, 0);
            }
        };
    }, [chunkedEntries.length, page]);

    return (
        <>
            <TableOfContentsLayout tableOfContents={undefined} hideTableOfContents={true} />
            {/* TODO(cd): treat as a guide for now, update for large-screen changelog */}
            <AsideAwareDiv className="fern-layout-changelog" isFullPage={isFullPage}>
                <article className="max-w-full">
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
                                            <div className="fern-changelog-label">
                                                <Badge asChild>
                                                    <FernLink href={slugToHref(entry.slug)} scroll={true}>
                                                        {entry.title}
                                                    </FernLink>
                                                </Badge>
                                                <div className="filter-row">
                                                    <PageFilters filters={entry.tags ?? []} forcePillDisplay />
                                                </div>
                                            </div>
                                        }
                                    >
                                        {entries[entry.pageId]}
                                    </ChangelogContentLayout>
                                    {i < visibleEntries.length - 1 && <hr className="my-4" />}
                                </Fragment>
                            );
                        })}
                    </HideBuiltWithFern>
                    <FooterLayout
                        hideFeedback
                        bottomNavigation={
                            configLayout.hideNavLinks ? undefined : <BottomNavigationClient prev={prev} next={next} />
                        }
                    />
                </article>
            </AsideAwareDiv>
        </>
    );
}
