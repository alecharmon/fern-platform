"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { useSidebarClientNavigation } from "./SidebarClientNavigationProvider";
import { PageData, PageDataWithChange } from "./types";

// Hook to sync client page changes from MdxStateContext to localStorage and staging
export function useClientPageSync(
  clientNodeId: NodeId | undefined,
  filename: string,
  pageData: Partial<PageData>,
  stageChanges?: (filename: string, state: PageDataWithChange) => void
) {
  const params = useParams();
  const branchName = params?.branch as string;
  const { updateClientPageData } = useSidebarClientNavigation();

  useEffect(() => {
    // Only sync if this is a client page and we have the required data
    if (
      !clientNodeId ||
      !branchName ||
      !pageData.html ||
      !pageData.frontmatter ||
      !pageData.originalElements
    ) {
      return;
    }

    const fullPageData: PageData = {
      html: pageData.html,
      frontmatter: pageData.frontmatter,
      originalElements: pageData.originalElements,
    };

    // Update localStorage with the latest page data
    if (updateClientPageData) {
      updateClientPageData(clientNodeId, fullPageData);
    }

    // Stage changes for commit
    if (stageChanges) {
      stageChanges(filename, {
        ...fullPageData,
        changed: true,
      });
    }
  }, [
    clientNodeId,
    branchName,
    filename,
    pageData.html,
    pageData.frontmatter,
    pageData.originalElements,
    updateClientPageData,
    stageChanges,
  ]);
}
