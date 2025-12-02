import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { type Availability, AvailabilityBadge } from "@fern-docs/components/badges/availability-badge";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import { getFrontmatter, sanitizeBreaks, sanitizeMdxExpression } from "@fern-docs/mdx";
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

    // Extract frontmatter without full MDX bundling (much faster)
    const sanitized = sanitizeMdxExpression(sanitizeBreaks(markdown))[0];
    const { data: extractedFrontmatter } = getFrontmatter(sanitized);
    const frontmatterSubtitle = extractedFrontmatter?.subtitle ?? extractedFrontmatter?.excerpt;

    // Serialize page content and subtitle in parallel
    // Note: We serialize the title after MDX parsing because remarkExtractTitle may extract it from h1 headers
    const [mdx, subtitleMdx, config, lang] = await Promise.all([
        serialize(markdown, {
            filename,
            toc: true,
            slug
        }),
        frontmatterSubtitle
            ? serialize(frontmatterSubtitle, {
                  filename,
                  slug
              })
            : Promise.resolve(undefined),
        loader.getConfig(),
        loader.getLanguage()
    ]);

    const exports = getMDXExport(mdx);
    const toc = asToc(exports?.toc);
    const frontmatter = mdx?.frontmatter ?? (exports?.frontmatter as Partial<FernDocs.Frontmatter> | undefined) ?? {};

    frontmatter["edit-this-page-url"] ??= editThisPageUrl;

    const title = frontmatter?.title ?? fallbackTitle;
    const subtitle = frontmatter?.subtitle ?? frontmatter?.excerpt;

    // Serialize the actual title (which may have been extracted from h1 by remarkExtractTitle)
    const titleMdx = await serialize(title, {
        filename,
        slug
    });

    const extractedStyles = mdx?.styles ?? [];

    const pageHeader = (
        <PageHeader
            serialize={serialize}
            title={title}
            titleMdx={titleMdx}
            subtitle={subtitle}
            subtitleMdx={subtitleMdx}
            breadcrumb={breadcrumb}
            slug={slug}
            markdownPromise={Promise.resolve({ content: markdown, contentType: "markdown" })}
            pageActionOptions={
                await constructPageOptions({
                    pageActionConfig: config,
                    domain: loader.domain,
                    slug,
                    lang
                })
            }
            tags={availability && <AvailabilityBadge availability={availability} rounded />}
            lang={lang}
            pageActionsStyle={config.theme?.["page-actions"] ?? "default"}
        />
    );

    // prefer frontmatter values over global config
    const footer = (
        <FooterLayout
            hideFeedback={frontmatter?.["hide-feedback"] ?? config.layout?.hideFeedback}
            hideNavLinks={frontmatter?.["hide-nav-links"] ?? config.layout?.hideNavLinks}
            editThisPageUrl={frontmatter?.["edit-this-page-url"]}
            bottomNavigation={bottomNavigation}
            lang={lang}
        />
    );

    return (
        <>
            {extractedStyles.length > 0 &&
                extractedStyles.map((css, index) => <style key={index} dangerouslySetInnerHTML={{ __html: css }} />)}
            <AbstractLayoutEvaluatorContent
                frontmatter={frontmatter}
                tableOfContents={toc}
                pageHeader={pageHeader}
                aside={
                    mdx && exports?.Aside ? (
                        <MdxAside code={mdx.code} jsxElements={mdx.jsxElements} engine={mdx?.engine} />
                    ) : undefined
                }
                footer={footer}
                builtWithFern={<BuiltWithFern className="mx-auto my-8 w-fit" lang={lang} />}
                lang={lang}
            >
                <MdxContent mdx={mdx} fallback={markdown} engine={mdx?.engine} />
            </AbstractLayoutEvaluatorContent>
        </>
    );
}
