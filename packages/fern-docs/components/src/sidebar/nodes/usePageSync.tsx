"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { useSidebarClientNavigation } from "./SidebarClientNavigationProvider";
import { PageStorage } from "./pageStorage";
import { PageData, PageDataWithChange } from "./types";

// Hook to sync page changes to localStorage for both client and server pages
export function usePageSync(
  filename: string,
  pageData: Partial<PageData>,
  clientNodeId?: NodeId,
  serverData?: PageData,
  stageChanges?: (filename: string, state: PageDataWithChange) => void
) {
  const params = useParams();
  const branchName = params?.branch as string;
  const { updateClientPageData } = useSidebarClientNavigation();

  // Track what we've already synced to prevent infinite loops
  const lastSyncedData = useRef<string>("");
  const hasStagedChanges = useRef<boolean>(false);
  const lastStagedDataHash = useRef<string>("");

  useEffect(() => {
    // Only sync if we have the required data
    if (
      !branchName ||
      !pageData.html ||
      !pageData.frontmatter ||
      !pageData.originalElements
    ) {
      return;
    }

    const completePageData = pageData as PageData;

    // Create a hash of the current data to detect changes
    const currentDataHash = JSON.stringify({
      html: completePageData.html,
      frontmatter: completePageData.frontmatter,
      originalElements: completePageData.originalElements,
    });

    // Skip if we've already synced this exact data
    if (lastSyncedData.current === currentDataHash) {
      return;
    }

    lastSyncedData.current = currentDataHash;

    // Reset staging flag when data actually changes
    if (lastStagedDataHash.current !== currentDataHash) {
      hasStagedChanges.current = false;
    }

    if (clientNodeId) {
      // This is a client page - use the existing client page storage
      if (updateClientPageData) {
        updateClientPageData(clientNodeId, completePageData);
      }
    } else {
      // This is a server page - use the new general page storage
      PageStorage.savePage(branchName, filename, {
        html: completePageData.html,
        frontmatter: completePageData.frontmatter,
        originalElements: completePageData.originalElements,
        pageType: "server",
        serverData: serverData,
      });
    }

    // Stage changes only if we haven't staged this exact data before
    if (stageChanges && lastStagedDataHash.current !== currentDataHash) {
      let shouldStage = false;

      if (clientNodeId) {
        // Always stage client pages since they don't exist on server
        shouldStage = true;
      } else if (serverData) {
        // For server pages, check if this data came from localStorage (meaning it has local changes)
        // OR if it differs from server data
        const storedPage = PageStorage.getPage(branchName, filename);
        const hasLocalChanges = storedPage && storedPage.pageType === "server";

        const dataHasChanges =
          completePageData.html !== serverData.html ||
          JSON.stringify(completePageData.frontmatter) !==
            JSON.stringify(serverData.frontmatter) ||
          JSON.stringify(completePageData.originalElements) !==
            JSON.stringify(serverData.originalElements);

        shouldStage = hasLocalChanges || dataHasChanges;
      } else {
        // Server page without server data - stage to be safe
        shouldStage = true;
      }

      if (shouldStage) {
        stageChanges(filename, {
          html: completePageData.html,
          frontmatter: completePageData.frontmatter,
          originalElements: completePageData.originalElements,
          changed: true,
        });
        lastStagedDataHash.current = currentDataHash;
        hasStagedChanges.current = true;
      }
    }
  }, [
    clientNodeId,
    branchName,
    filename,
    pageData,
    updateClientPageData,
    stageChanges,
    serverData,
  ]);
}
