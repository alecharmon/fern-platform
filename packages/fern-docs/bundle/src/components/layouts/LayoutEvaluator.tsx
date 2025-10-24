import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { type Availability, AvailabilityBadge } from "@fern-docs/components/badges/availability-badge";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import type React from "react";

import { MdxAside } from "@/mdx/bundler/component";
import { MdxContent } from "@/mdx/components/MdxContent";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { asToc, getMDXExport } from "../../mdx/get-mdx-export";
import { BuiltWithFern } from "../built-with-fern";
import { constructPageOptions } from "../PageActionsDropdownOptions";
import { PageHeader } from "../PageHeader";
import { FooterLayout } from "./FooterLayout";

export async function LayoutEvaluator({
    loader,
    serialize,
    fallbackTitle,
    pageId,
    breadcrumb,
    bottomNavigation,
    slug,
    availability
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    fallbackTitle: string;
    pageId: FernNavigation.PageId;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation?: React.ReactNode;
    slug: string;
    availability?: Availability;
}) {
    const { filename, markdown, editThisPageUrl } = await loader.getPage(pageId);
    const mdx = await serialize(markdown, {
        filename,
        toc: true,
        slug
    });

    const exports = getMDXExport(mdx);
    const toc = asToc(exports?.toc);
    const frontmatter = mdx?.frontmatter ?? (exports?.frontmatter as Partial<FernDocs.Frontmatter> | undefined) ?? {};

    frontmatter["edit-this-page-url"] ??= editThisPageUrl;

    const title = frontmatter?.title ?? fallbackTitle;
    const subtitle = frontmatter?.subtitle ?? frontmatter?.excerpt;

    const config = await loader.getConfig();

    const pageHeader = (
        <PageHeader
            serialize={serialize}
            title={title}
            subtitle={subtitle}
            breadcrumb={breadcrumb}
            slug={slug}
            markdownPromise={Promise.resolve({ content: markdown, contentType: "markdown" })}
            pageActionOptions={
                await constructPageOptions({
                    pageActionConfig: config,
                    domain: loader.domain,
                    slug
                })
            }
            tags={availability && <AvailabilityBadge availability={availability} rounded />}
        />
    );

    // prefer frontmatter values over global config
    const footer = (
        <FooterLayout
            hideFeedback={frontmatter?.["hide-feedback"] ?? config.layout?.hideFeedback}
            hideNavLinks={frontmatter?.["hide-nav-links"] ?? config.layout?.hideNavLinks}
            editThisPageUrl={frontmatter?.["edit-this-page-url"]}
            bottomNavigation={bottomNavigation}
        />
    );

    return (
        <AbstractLayoutEvaluatorContent
            frontmatter={frontmatter}
            tableOfContents={toc}
            pageHeader={pageHeader}
            aside={
                mdx && exports?.Aside ? (
                    <MdxAside
                        code={mdx.code}
                        jsxElements={mdx.jsxElements}
                        useNextMdx={mdx?.engine === "next-remote"}
                    />
                ) : undefined
            }
            footer={footer}
            builtWithFern={<BuiltWithFern className="mx-auto my-8 w-fit" />}
        >
            <MdxContent mdx={mdx} fallback={markdown} useNextMdx={mdx?.engine === "next-remote"} />
        </AbstractLayoutEvaluatorContent>
    );
}
