import "server-only";

import React, { ReactElement } from "react";

import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { Badge } from "@fern-docs/components/badges";
import { FernLink } from "@fern-docs/components/FernLink";
import { AsideAwareDiv } from "@fern-docs/components/layouts/AsideAwareDiv";
import { SetLayout } from "@fern-docs/components/state/layout";

import { HideBuiltWithFern } from "@/components/built-with-fern";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { MdxSerializer } from "@/server/mdx-serializer";

import { PageFilters } from "../PageFilters";
import { ChangelogContentLayout } from "./ChangelogContentLayout";

// sidebar is always hidden on changelog entry pages
export default function ChangelogEntryPage({
    loader,
    serialize,
    node,
    overview,
    bottomNavigation,
    children
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    node: FernNavigation.ChangelogEntryNode;
    overview: React.ReactNode;
    bottomNavigation: React.ReactNode;
    children: React.ReactNode;
}): ReactElement<any> {
    return (
        <AsideAwareDiv className="fern-layout-changelog" isFullPage={true}>
            <SetLayout value="page" />
            <article className="fern-layout-page">
                <HideBuiltWithFern>
                    <ChangelogContentLayout as="section" className="mb-8">
                        {overview}
                    </ChangelogContentLayout>
                    <ChangelogContentLayout
                        as="article"
                        id={node.date}
                        stickyContent={
                            <div className="fern-changelog-label">
                                <Badge asChild>
                                    <FernLink href={slugToHref(node.slug)} scroll={true}>
                                        {node.title}
                                    </FernLink>
                                </Badge>
                                <div className="filter-row">
                                    <PageFilters filters={node.tags ?? []} forcePillDisplay />
                                </div>
                            </div>
                        }
                    >
                        {children}
                    </ChangelogContentLayout>
                </HideBuiltWithFern>
                <FooterLayoutWithEditThisPageUrl
                    slug={node.slug}
                    pageId={node.pageId}
                    loader={loader}
                    serialize={serialize}
                    bottomNavigation={bottomNavigation}
                />
            </article>
        </AsideAwareDiv>
    );
}

async function FooterLayoutWithEditThisPageUrl({
    pageId,
    loader,
    serialize,
    slug,
    bottomNavigation
}: {
    pageId: string;
    loader: DocsLoader;
    serialize: MdxSerializer;
    slug: string;
    bottomNavigation: React.ReactNode;
}) {
    // all this does is get the edit this page url from the mdx frontmatter, but hopefully the mdx was already serialized and cached
    const page = await loader.getPage(pageId);
    const mdx = await serialize(page.markdown, {
        filename: page.filename,
        slug
    });
    const editThisPageUrl = mdx?.frontmatter?.["edit-this-page-url"] ?? page.editThisPageUrl;

    const configLayout = await loader.getLayout();

    return (
        <FooterLayout
            hideFeedback={mdx?.frontmatter?.["hide-feedback"] ?? configLayout.hideFeedback}
            hideNavLinks={mdx?.frontmatter?.["hide-nav-links"] ?? configLayout.hideNavLinks}
            bottomNavigation={bottomNavigation}
            editThisPageUrl={editThisPageUrl}
        />
    );
}
