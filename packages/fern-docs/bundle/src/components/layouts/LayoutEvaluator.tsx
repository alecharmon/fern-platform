import "server-only";

import { ParamValue } from "next/dist/server/request/params";
import React from "react";

import { isSelfHosted } from "@fern-api/docs-server";
import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { DocsV1Read } from "@fern-api/fdr-sdk";
import type * as FernDocs from "@fern-api/fdr-sdk/docs";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { FernDropdown } from "@fern-docs/components";
import {
  Availability,
  AvailabilityBadge,
} from "@fern-docs/components/badges/availability-badge";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";

import { MdxAside } from "@/mdx/bundler/component";
import { MdxContent } from "@/mdx/components/MdxContent";
import { MdxSerializer } from "@/server/mdx-serializer";

import { asToc, getMDXExport } from "../../mdx/get-mdx-export";
import {
  CopyPageOption,
  OpenWithLLM,
  Separator,
  ViewAsMarkdownOption,
} from "../PageActionsDropdownOptions";
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
  availability,
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

  const config = await loader.getConfig();

  const pageHeader = (
    <PageHeader
      serialize={serialize}
      title={title}
      subtitle={subtitle}
      breadcrumb={breadcrumb}
      slug={slug}
      markdown={markdown}
      pageActionOptions={constructPageOptions({
        pageActionConfig: config,
        domain: loader.domain,
        slug,
        frontmatterLayout,
      })}
      tags={
        availability && (
          <AvailabilityBadge availability={availability} rounded />
        )
      }
    />
  );

  // prefer frontmatter values over global config
  const footer = (
    <FooterLayout
      hideFeedback={
        frontmatter?.["hide-feedback"] ?? config.layout?.hideFeedback
      }
      hideNavLinks={
        frontmatter?.["hide-nav-links"] ?? config.layout?.hideNavLinks
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

function shouldHideDropdown(
  frontmatterLayout: string,
  config: Omit<DocsV1Read.DocsConfig, "navigation" | "root">
) {
  if (frontmatterLayout === "reference") {
    return !config.pageActions?.apiReference;
  }
  return false;
}

function constructPageOptions({
  pageActionConfig,
  domain,
  slug,
  frontmatterLayout,
}: {
  pageActionConfig: Omit<DocsV1Read.DocsConfig, "navigation" | "root">;
  domain: ParamValue;
  slug: ParamValue;
  frontmatterLayout: string;
}): FernDropdown.PageActionOption[] | undefined {
  if (shouldHideDropdown(frontmatterLayout, pageActionConfig)) {
    return undefined;
  }

  const options: FernDropdown.PageActionOption[] = [
    CopyPageOption(),
    Separator(),
    ViewAsMarkdownOption(),
  ];

  if (isSelfHosted()) {
    return options;
  }

  if (pageActionConfig.pageActions?.claude !== false) {
    options.push(Separator(), OpenWithLLM({ domain, slug, llm: "Claude" }));
  }

  if (pageActionConfig.pageActions?.openAi !== false) {
    options.push(Separator(), OpenWithLLM({ domain, slug, llm: "ChatGPT" }));
  }

  return options;
}
