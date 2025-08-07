"use client";

import { useCallback, useEffect } from "react";

import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { useSidebarClientNavigation } from "./SidebarClientNavigationProvider";
import { ClientPageStorage } from "./clientPageStorage";

interface ClientPageManagerProps {
  branchName: string;
}

export function ClientPageManager({
  branchName: _branchName,
}: ClientPageManagerProps) {
  // Function to clean up old client pages across all branches
  const cleanupOldClientPages = useCallback(() => {
    const branches = ClientPageStorage.getAllStoredBranches();
    branches.forEach((branch) => {
      const pages = ClientPageStorage.loadClientPages(branch);
      Object.entries(pages).forEach(([nodeId, page]) => {
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - page.createdAt > weekInMs) {
          ClientPageStorage.removeClientPage(branch, nodeId as NodeId);
        }
      });
    });
  }, []);

  // Clean up old pages on mount
  useEffect(() => {
    cleanupOldClientPages();
  }, [cleanupOldClientPages]);

  // This component doesn't render anything
  return null;
}

// Hook to use client page manager functions
export function useClientPageManager(branchName: string) {
  const { removeClientNode } = useSidebarClientNavigation();

  const cleanupClientPage = useCallback(
    (nodeId: NodeId) => {
      removeClientNode?.(nodeId);
    },
    [removeClientNode]
  );

  const cleanupAllClientPages = useCallback(() => {
    ClientPageStorage.clearAllClientPages(branchName);
  }, [branchName]);

  const getClientPages = useCallback(() => {
    return ClientPageStorage.loadClientPages(branchName);
  }, [branchName]);

  const getClientPageCount = useCallback(() => {
    const pages = ClientPageStorage.loadClientPages(branchName);
    return Object.keys(pages).length;
  }, [branchName]);

  return {
    cleanupClientPage,
    cleanupAllClientPages,
    getClientPages,
    getClientPageCount,
  };
}
