"use client";

import { useEffect, useMemo, useRef } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { usePageSync } from "@fern-docs/components";
import { MdxToHtmlResponse } from "@fern-docs/mdx";

import { useCurrentPage } from "@/providers/CurrentPageContext";
import { useMdxState } from "@/providers/MdxStateContext";
import { useOriginalElements } from "@/providers/OriginalElementsContext";

import PageEditor from "./PageEditor";
import PageSubtitle from "./PageSubtitle";
import PageTitle from "./PageTitle";
import { bundleOriginalElements } from "./bundleOriginalElements";

export declare namespace PageContents {
  export interface Props {
    filename: string;
    initialHtml: MdxToHtmlResponse["html"];
    initialFrontmatter: MdxToHtmlResponse["frontmatter"];
    initialOriginalElements: MdxToHtmlResponse["originalElements"];
    initialOriginalFrontmatter: MdxToHtmlResponse["originalFrontmatter"];
    clientNodeId?: NodeId;
    serverData?: {
      html: string;
      frontmatter: Record<string, any>;
      originalElements: any;
    };
  }
}

export default function PageContents({
  filename,
  initialHtml,
  initialFrontmatter,
  initialOriginalElements,
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
      originalElements: currentPageData?.originalElements,
    };
  }, [mdxDepsStore, filename]);
  usePageSync(filename, pageData, clientNodeId, serverData, stageChanges);

  const { originalElements, setOriginalElements } = useOriginalElements();

  // Track what we've already bundled to prevent infinite loops
  const bundledElementsRef = useRef<string>("");

  useEffect(() => {
    // Create a stable hash of the original elements to detect actual changes
    const elementsHash = JSON.stringify(
      Object.entries(originalElements).map(([key, element]) => [
        key,
        element.content,
      ])
    );

    // Only bundle if content has actually changed and elements need bundling
    const needsBundling = Object.values(originalElements).some(
      (element) => !element.code
    );

    if (needsBundling && bundledElementsRef.current !== elementsHash) {
      // IMPORTANT: This fix prevents async state updates from triggering
      // during error boundary recovery by:

      // 1. Adding cancellation token to track if the
      // component/effect should still update state
      // 2. Cleanup function that cancels pending async
      // operations when effect dependencies change (including
      // during error boundary recovery)
      // 3. Conditional state update that only proceeds if not
      // cancelled

      // Now when an error boundary recovers and triggers
      // re-renders, any pending bundleOriginalElements promises
      //  won't cause state updates that could interfere with
      // React's hook reconciliation.
      let cancelled = false;

      void bundleOriginalElements(originalElements).then((bundled) => {
        // Prevent state updates after component unmounts or error boundary recovery
        if (!cancelled) {
          setOriginalElements(bundled);
          bundledElementsRef.current = elementsHash;
        }
      });

      // Cleanup function to prevent state updates during error boundary recovery
      return () => {
        cancelled = true;
      };
    }

    // Return undefined when no bundling is needed
    return undefined;
  }, [originalElements, setOriginalElements]);

  useEffect(() => {
    // Set this as the current active page
    setCurrentFilename(filename);
    updateDependencies(filename, {
      html: initialHtml,
      frontmatter: initialFrontmatter,
      originalElements: initialOriginalElements,
      originalFrontmatter: initialOriginalFrontmatter,
    });
  }, [
    filename,
    initialHtml,
    initialFrontmatter,
    initialOriginalElements,
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
