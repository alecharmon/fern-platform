"use client";

import { useEffect, useMemo, useRef } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { usePageSync } from "@fern-docs/components";
import { MdxToHtmlResponse } from "@fern-docs/mdx";

import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useMdxState } from "@/providers/MdxStateContext";

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
    serverData?: {
      html: string;
      frontmatter: Record<string, any>;
    };
  }
}

export default function PageContents({
  filename,
  initialHtml,
  initialFrontmatter,
  initialOriginalFrontmatter,
  clientNodeId,
  serverData,
}: PageContents.Props) {
  const { title, subtitle } = initialFrontmatter ?? {};

  const { setCurrentFilename } = useCurrentPage();
  const {
    updateDependencies,
    changedMdxFiles,
    syncChanges,
    mdxDepsStore,
    stageChanges,
  } = useMdxState();

  // Sync page changes to localStorage and staging (works for both client and server pages)
  const pageData = useMemo(() => {
    const currentPageData = mdxDepsStore[filename];
    return {
      html: currentPageData?.html,
      frontmatter: currentPageData?.frontmatter,
    };
  }, [mdxDepsStore, filename]);
  usePageSync(filename, pageData, clientNodeId, serverData, stageChanges);

  useEffect(() => {
    // Set this as the current active page
    setCurrentFilename(filename);
    updateDependencies(filename, {
      html: initialHtml,
      frontmatter: initialFrontmatter,
      originalFrontmatter: initialOriginalFrontmatter,
    });
  }, [
    filename,
    initialHtml,
    initialFrontmatter,
    initialOriginalFrontmatter,
    updateDependencies,
    setCurrentFilename,
  ]);

  const changedMdxFile = changedMdxFiles[filename];
  const lastSyncedContent = useRef<string | undefined>(undefined);

  // Watch for changes and sync to server - only sync if content actually changed
  useEffect(() => {
    if (changedMdxFile && changedMdxFile !== lastSyncedContent.current) {
      lastSyncedContent.current = changedMdxFile;
      syncChanges(filename);
    }
  }, [changedMdxFile, filename, syncChanges]);

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
