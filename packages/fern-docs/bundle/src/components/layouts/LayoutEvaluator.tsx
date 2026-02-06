import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { type Availability, AvailabilityBadge } from "@fern-docs/components/badges/availability-badge";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import type React from "react";

import { MdxAside } from "@/mdx/bundler/component";
import { MdxContent } from "@/mdx/components/MdxContent";
import { filterMarkdownContent } from "@/server/getMarkdownForPath";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { asToc, getMDXExport } from "../../mdx/get-mdx-export";
import { BuiltWithFern } from "../built-with-fern";
import { CustomFooterLinks } from "../footer/CustomFooterLinks";
import { constructPageOptions } from "../PageActionsOptions";
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
    const { filename, markdown, editThisPageUrl, editThisPageLaunch } = await loader.getPage(pageId);
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
    const lang = await loader.getLanguage();
    const theme = await loader.getTheme();

    const extractedStyles = mdx?.styles ?? [];

    const files = await loader.getFiles();
    const metadata = await loader.getMetadata();

    const isAskAiEnabled = await loader.isAskAiEnabledForDocs();

    const pageActions = frontmatter?.["hide-page-actions"]
        ? undefined
        : await constructPageOptions({
              pageActionConfig: config,
              domain: loader.domain,
              slug,
              lang,
              files,
              basePath: metadata.basePath,
              isAskAiEnabled
          });

    const authState = await loader.getAuthState();
    const userRoles = authState.authed ? (authState.user.roles ?? []) : [];
    const filteredMarkdown = filterMarkdownContent(markdown, pageId, userRoles);

    const pageHeader = (
        <PageHeader
            serialize={serialize}
            title={title}
            subtitle={subtitle}
            breadcrumb={breadcrumb}
            slug={slug}
            markdownPromise={Promise.resolve(filteredMarkdown)}
            pageActionOptions={pageActions}
            tags={availability && <AvailabilityBadge availability={availability} rounded />}
            lang={lang}
            pageActionsStyle={config.theme?.["page-actions"] ?? "default"}
        />
    );

    // prefer frontmatter values over global config
    // Construct full docs URL including basePath (e.g., "buildwithfern.com/learn")
    // Strip any leading slash from basePath to avoid double slashes
    const basePath = metadata.basePath?.replace(/^\//, "");
    const fullDocsUrl = basePath ? `${loader.domain}/${basePath}` : loader.domain;

    const footer = (
        <FooterLayout
            hideFeedback={frontmatter?.["hide-feedback"] ?? config.layout?.hideFeedback}
            hideNavLinks={frontmatter?.["hide-nav-links"] ?? config.layout?.hideNavLinks}
            editThisPageUrl={frontmatter?.["edit-this-page-url"]}
            editThisPageLaunch={editThisPageLaunch}
            docsUrl={fullDocsUrl}
            slug={slug}
            orgName={metadata.org}
            bottomNavigation={bottomNavigation}
            footerLinks={<CustomFooterLinks loader={loader} className="mt-8" />}
            lang={lang}
            hasMultipleLanguages={config.languages != null && config.languages.length > 1}
            lastUpdated={frontmatter?.["last-updated"]}
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
                theme={theme}
            >
                <MdxContent mdx={mdx} fallback={markdown} engine={mdx?.engine} />
            </AbstractLayoutEvaluatorContent>
        </>
    );
}
