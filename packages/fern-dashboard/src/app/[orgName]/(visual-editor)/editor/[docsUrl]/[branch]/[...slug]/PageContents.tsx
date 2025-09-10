"use client";

import { useEffect } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { MdxToHtmlResponse } from "@fern-docs/mdx";

import { useCurrentPage } from "@/providers/CurrentPageContext";
import { usePages } from "@/providers/PagesStoreContext";

import PageEditor from "./PageEditor";
import PageSubtitle from "./PageSubtitle";
import PageTitle from "./PageTitle";

export declare namespace PageContents {
  export interface Props {
    filename: string;
    initialHtml: MdxToHtmlResponse["html"];
    initialFrontmatter: MdxToHtmlResponse["frontmatter"];
    initialOriginalFrontmatter: MdxToHtmlResponse["originalFrontmatter"];
    clientNodeId?: NodeId;
  }
}

export default function PageContents({
  filename,
  initialHtml,
  initialFrontmatter,
  initialOriginalFrontmatter,
  clientNodeId,
}: PageContents.Props) {
  const { title, subtitle } = initialFrontmatter ?? {};

  const { setCurrentFilename } = useCurrentPage();
  const { initializePage } = usePages();

  useEffect(() => {
    // Set this as the current active page
    setCurrentFilename(filename);

    // Initialize page with initial server data in the store
    // PagesStore handles duplicate prevention internally
    initializePage(
      filename,
      clientNodeId,
      initialHtml,
      initialFrontmatter,
      initialOriginalFrontmatter
    );
  }, [
    filename,
    clientNodeId,
    initialHtml,
    initialFrontmatter,
    initialOriginalFrontmatter,
    initializePage,
    setCurrentFilename,
  ]);

  return (
    <div className="max-w-content-width-wide mx-auto w-full">
      <PageTitle
        className="w-full"
        filename={filename}
        initialText={title ? String(title) : undefined}
      />
      <PageSubtitle
        className="w-full"
        filename={filename}
        initialText={subtitle ? String(subtitle) : undefined}
      />
      <PageEditor
        className="w-full"
        filename={filename}
        initialHtml={initialHtml}
      />
    </div>
  );
}
