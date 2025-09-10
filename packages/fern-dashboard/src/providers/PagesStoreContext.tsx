"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
} from "react";

import { useNavigation } from "@fern-docs/components";

import { PagesSnapshot, PagesStore } from "./PagesStore";

export type { PagesSnapshot };

interface PagesStoreContextValue {
  pagesStore: PagesStore;
}

const PagesStoreContext = createContext<PagesStoreContextValue | null>(null);

export interface PagesStoreProviderProps {
  children: ReactNode;
  branchName: string;
}

export function PagesStoreProvider({
  children,
  branchName,
}: PagesStoreProviderProps) {
  const { _navigationStore } = useNavigation();
  const storeRef = useRef<PagesStore>(new PagesStore(_navigationStore));

  if (
    !storeRef.current ||
    storeRef.current.navigationStore !== _navigationStore ||
    _navigationStore.branchName !== branchName
  ) {
    storeRef.current = new PagesStore(_navigationStore);
  }

  return (
    <PagesStoreContext.Provider value={{ pagesStore: storeRef.current }}>
      {children}
    </PagesStoreContext.Provider>
  );
}

function usePagesStore(): PagesStore {
  const context = useContext(PagesStoreContext);
  if (!context) {
    throw new Error("usePagesStore must be used within a PagesStoreProvider");
  }
  return context.pagesStore;
}

export function usePages(): PagesSnapshot & {
  _pagesStore: PagesStore;
  createPage: PagesStore["createPage"];
  prepareCommit: PagesStore["prepareCommit"];
  isCommitted: PagesStore["isCommitted"];
  handleCommitSuccess: PagesStore["handleCommitSuccess"];
  setDocsYmlBaseContent: PagesStore["setDocsYmlBaseContent"];
  buildPageDataFromSources: PagesStore["buildPageDataFromSources"];
  initializePage: PagesStore["initializePage"];
  applyPageChange: PagesStore["applyPageChange"];
  updatePage: PagesStore["updatePage"];
} {
  const store = usePagesStore();
  const snapshot = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store),
    store.getServerSnapshot.bind(store)
  );

  return {
    ...snapshot,
    _pagesStore: store,
    createPage: store.createPage.bind(store),
    prepareCommit: store.prepareCommit.bind(store),
    isCommitted: store.isCommitted.bind(store),
    handleCommitSuccess: store.handleCommitSuccess.bind(store),
    setDocsYmlBaseContent: store.setDocsYmlBaseContent.bind(store),
    buildPageDataFromSources: store.buildPageDataFromSources.bind(store),
    initializePage: store.initializePage.bind(store),
    applyPageChange: store.applyPageChange.bind(store),
    updatePage: store.updatePage.bind(store),
  };
}
