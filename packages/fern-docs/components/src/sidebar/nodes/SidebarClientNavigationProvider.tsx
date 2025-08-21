"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { ClientPageStorage } from "./clientPageStorage";
import { NavigationContext, PageData } from "./types";

type ClientNodes = Record<NodeId, FernNavigation.PageNode[]>;

type ClientFoundNodes = Record<NodeId, FernNavigation.utils.Node.Found>;

interface SidebarClientNavigationContextValue {
  clientNodes?: ClientNodes;
  clientFoundNodes?: ClientFoundNodes;
  isInitialized?: boolean;
  prependClientNode?: (
    parentNodeId: NodeId,
    node: FernNavigation.PageNode,
    sidebar?: FernNavigation.SidebarRootNode,
    pageData?: PageData,
    fullSlug?: string,
    navigationContext?: NavigationContext
  ) => void;
  removeClientNode?: (nodeId: NodeId) => void;
  updateClientPageData?: (nodeId: NodeId, pageData: PageData) => void;
}

const SidebarClientNavigationContext =
  createContext<SidebarClientNavigationContextValue>({});

interface SidebarClientNavigationProviderProps {
  children: React.ReactNode;
  branchName: string;
}

// Helper function to load and process stored client pages
function loadAndProcessStoredPages(branchName: string) {
  // During SSR, localStorage is not available, so return empty objects
  if (typeof window === "undefined") {
    return { clientNodes: {}, clientFoundNodes: {} };
  }

  const storedPages = ClientPageStorage.loadClientPages(branchName);

  const clientNodes: ClientNodes = {};
  const clientFoundNodes: ClientFoundNodes = {};

  // Sort stored pages by creation time (newest first) to preserve order
  const sortedEntries = Object.entries(storedPages).sort(
    ([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  sortedEntries.forEach(([nodeId, storedPage]) => {
    const { node, parentNodeId, sidebar, navigationContext } = storedPage;

    // Add to clientNodes grouped by parent
    if (!clientNodes[parentNodeId]) {
      clientNodes[parentNodeId] = [];
    }
    clientNodes[parentNodeId].push(node);

    // Add to clientFoundNodes with stored navigation context
    clientFoundNodes[nodeId as NodeId] = {
      type: "found",
      node,
      sidebar,
      currentProduct: navigationContext?.currentProduct,
      currentVersion: navigationContext?.currentVersion,
      currentTab: navigationContext?.currentTab,
      isCurrentVersionDefault:
        navigationContext?.isCurrentVersionDefault ?? false,
      isCurrentProductDefault:
        navigationContext?.isCurrentProductDefault ?? false,
    } as FernNavigation.utils.Node.Found;
  });

  return { clientNodes, clientFoundNodes };
}

export function SidebarClientNavigationProvider({
  children,
  branchName,
}: SidebarClientNavigationProviderProps) {
  // Lazy initialization to load client pages synchronously on first access
  const [state, setState] = useState<{
    clientNodes: ClientNodes;
    clientFoundNodes: ClientFoundNodes;
    isInitialized: boolean;
  }>(() => {
    const { clientNodes, clientFoundNodes } =
      loadAndProcessStoredPages(branchName);

    return {
      clientNodes,
      clientFoundNodes,
      isInitialized: true,
    };
  });

  // Update state when branchName changes
  useEffect(() => {
    const {
      clientNodes: newClientNodes,
      clientFoundNodes: newClientFoundNodes,
    } = loadAndProcessStoredPages(branchName);

    setState({
      clientNodes: newClientNodes,
      clientFoundNodes: newClientFoundNodes,
      isInitialized: true,
    });
  }, [branchName]);

  const { clientNodes, clientFoundNodes, isInitialized } = state;

  const prependClientNode = useCallback(
    (
      parentNodeId: NodeId,
      node: FernNavigation.PageNode,
      sidebar?: FernNavigation.SidebarRootNode,
      pageData?: PageData,
      fullSlug?: string,
      navigationContext?: NavigationContext
    ) => {
      // Update local state
      setState((prevState) => ({
        ...prevState,
        clientNodes: {
          ...prevState.clientNodes,
          [parentNodeId]: [
            node,
            ...(prevState.clientNodes[parentNodeId] || []),
          ],
        },
        clientFoundNodes: {
          ...prevState.clientFoundNodes,
          [node.id]: {
            type: "found",
            node,
            sidebar,
            currentProduct: navigationContext?.currentProduct,
            currentVersion: navigationContext?.currentVersion,
            currentTab: navigationContext?.currentTab,
            isCurrentVersionDefault:
              navigationContext?.isCurrentVersionDefault ?? false,
            isCurrentProductDefault:
              navigationContext?.isCurrentProductDefault ?? false,
          } as FernNavigation.utils.Node.Found,
        },
      }));

      // Persist to localStorage
      ClientPageStorage.addClientPage(branchName, node.id, {
        node,
        parentNodeId,
        sidebar,
        pageData,
        fullSlug: fullSlug || node.slug || "",
        navigationContext,
      });
    },
    [branchName]
  );

  const removeClientNode = useCallback(
    (nodeId: NodeId) => {
      setState((prevState) => {
        // Find the parent node ID to remove from clientNodes
        let parentNodeId: NodeId | undefined;
        for (const [parent, nodes] of Object.entries(prevState.clientNodes)) {
          if (nodes.some((n) => n.id === nodeId)) {
            parentNodeId = parent as NodeId;
            break;
          }
        }

        const newClientNodes = { ...prevState.clientNodes };
        if (parentNodeId) {
          newClientNodes[parentNodeId] = (
            prevState.clientNodes[parentNodeId] || []
          ).filter((n) => n.id !== nodeId);
        }

        const { [nodeId]: removed, ...newClientFoundNodes } =
          prevState.clientFoundNodes;

        return {
          ...prevState,
          clientNodes: newClientNodes,
          clientFoundNodes: newClientFoundNodes,
        };
      });

      // Remove from localStorage
      ClientPageStorage.removeClientPage(branchName, nodeId);
    },
    [branchName]
  );

  const updateClientPageData = useCallback(
    (nodeId: NodeId, pageData: PageData) => {
      ClientPageStorage.updateClientPageData(branchName, nodeId, pageData);
    },
    [branchName]
  );

  const contextValue = useMemo(
    () => ({
      clientNodes,
      clientFoundNodes,
      isInitialized,
      prependClientNode,
      removeClientNode,
      updateClientPageData,
    }),
    [
      clientNodes,
      clientFoundNodes,
      isInitialized,
      prependClientNode,
      removeClientNode,
      updateClientPageData,
    ]
  );

  return (
    <SidebarClientNavigationContext.Provider value={contextValue}>
      {children}
    </SidebarClientNavigationContext.Provider>
  );
}

export function useSidebarClientNavigation() {
  const context = useContext(SidebarClientNavigationContext);

  // no-op when provider isn't available e.g. in production docs (SSR) environment
  return context;
}
