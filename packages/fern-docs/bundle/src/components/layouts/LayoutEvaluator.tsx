import "server-only";

import React from "react";

import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";

import { MdxAside } from "@/mdx/bundler/component";
import { MdxContent } from "@/mdx/components/MdxContent";
import { MdxSerializer } from "@/server/mdx-serializer";

import { asToc, getMDXExport } from "../../mdx/get-mdx-export";
import { PageHeader } from "../PageHeader";
import { BuiltWithFern } from "../built-with-fern";
import { FooterLayout } from "./FooterLayout";

export async function LayoutEvaluator({
  loader,
  serialize,
  fallbackTitle,
  pageId,
  breadcrumb,
  bottomNavigation,
  slug,
}: {
  loader: DocsLoader;
  serialize: MdxSerializer;
  fallbackTitle: string;
  pageId: FernNavigation.PageId;
  breadcrumb: readonly FernNavigation.BreadcrumbItem[];
  bottomNavigation?: React.ReactNode;
  slug: string;
}) {
  const { filename, markdown, editThisPageUrl } = await loader.getPage(pageId);
  const mdx = await serialize(markdown, {
    filename,
    toc: true,
    slug,
  });

  const exports = getMDXExport(mdx);
  const toc = asToc(exports?.toc);
  const frontmatter =
    mdx?.frontmatter ??
    (exports?.frontmatter as Partial<FernDocs.Frontmatter> | undefined) ??
    {};

  frontmatter["edit-this-page-url"] ??= editThisPageUrl;

  const title = frontmatter?.title ?? fallbackTitle;
  const subtitle = frontmatter?.subtitle ?? frontmatter?.excerpt;

  let frontmatterLayout = frontmatter?.layout ?? "guide";
  const hasAside = mdx && exports?.Aside;
  if (hasAside) {
    frontmatterLayout = "reference";
  }

  const configLayout = await loader.getLayout();

  const pageHeader = (
    <PageHeader
      serialize={serialize}
      title={title}
      subtitle={subtitle}
      breadcrumb={breadcrumb}
      slug={slug}
      markdown={markdown}
      includeDropdown={frontmatterLayout !== "reference"}
    />
  );

  // prefer frontmatter values over global config
  const footer = (
    <FooterLayout
      hideFeedback={frontmatter?.["hide-feedback"] ?? configLayout.hideFeedback}
      hideNavLinks={
        frontmatter?.["hide-nav-links"] ?? configLayout.hideNavLinks
      }
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
        hasAside ? (
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
      <MdxContent
        mdx={mdx}
        fallback={markdown}
        useNextMdx={mdx?.engine === "next-remote"}
      />
    </AbstractLayoutEvaluatorContent>
  );
}
