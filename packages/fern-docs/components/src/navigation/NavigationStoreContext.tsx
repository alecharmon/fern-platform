"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useSyncExternalStore } from "react";

import { NavigationStore } from "./NavigationStore";
import type { DeletionToastCallback, NavigationSnapshot } from "./types";

interface NavigationStoreContextValue {
    navigationStore: NavigationStore;
}

const NavigationStoreContext = createContext<NavigationStoreContextValue | null>(null);

export interface NavigationStoreProviderProps {
    children: ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
    initialDocsYmlContent: string | null;
    deletionToastCallback?: DeletionToastCallback;
}

export function NavigationStoreProvider({
    children,
    branchName,
    orgName,
    docsUrl,
    initialDocsYmlContent,
    deletionToastCallback
}: NavigationStoreProviderProps) {
    const storeRef = useRef<NavigationStore>(new NavigationStore(branchName, orgName, docsUrl));

    if (
        !storeRef.current ||
        storeRef.current.branchName !== branchName ||
        storeRef.current.orgName !== orgName ||
        storeRef.current.docsUrl !== docsUrl
    ) {
        storeRef.current = new NavigationStore(branchName, orgName, docsUrl);
    }

    useEffect(() => {
        void storeRef.current.hydrate({ initialDocsYmlContent });
    }, [initialDocsYmlContent]);

    useEffect(() => {
        if (deletionToastCallback) {
            storeRef.current.setDeletionToastCallback(deletionToastCallback);
        }
    }, [deletionToastCallback]);

    return (
        <NavigationStoreContext.Provider value={{ navigationStore: storeRef.current }}>
            {children}
        </NavigationStoreContext.Provider>
    );
}

function useNavigationStore(): NavigationStore {
    const context = useContext(NavigationStoreContext);
    if (!context) {
        throw new Error("useNavigationStore must be used within a NavigationStoreProvider");
    }
    return context.navigationStore;
}

type NavigationSnapshotWithMethods = NavigationSnapshot & {
    _navigationStore: NavigationStore;
    hydrated: NavigationStore["hydrated"];
    registeredPages: NavigationStore["registeredPages"];
    files: NavigationStore["files"];
    resolveInitialPageData: NavigationStore["resolveInitialPageData"];
    registerPage: NavigationStore["registerPage"];
    createClientPage: NavigationStore["createClientPage"];
    updatePage: NavigationStore["updatePage"];
    updatePageFrontmatter: NavigationStore["updatePageFrontmatter"];
    updatePageHtml: NavigationStore["updatePageHtml"];
    resetPage: NavigationStore["resetPage"];
    markPageForDeletion: NavigationStore["markPageForDeletion"];
    unmarkPageForDeletion: NavigationStore["unmarkPageForDeletion"];
    setDeletionToastCallback: NavigationStore["setDeletionToastCallback"];
    emitPageSaveEvent: NavigationStore["emitPageSaveEvent"];
    subscribePageSaveEvent: NavigationStore["subscribePageSaveEvent"];
    emitNestedEditorUpdate: NavigationStore["emitNestedEditorUpdate"];
    subscribeNestedEditorUpdate: NavigationStore["subscribeNestedEditorUpdate"];
    handleCommitSuccess: NavigationStore["handleCommitSuccess"];
};

function createNavigationSnapshot(store: NavigationStore, snapshot: NavigationSnapshot): NavigationSnapshotWithMethods {
    return {
        ...snapshot,
        _navigationStore: store,
        hydrated: store.hydrated,
        registeredPages: store.registeredPages,
        files: store.files,
        resolveInitialPageData: store.resolveInitialPageData.bind(store),
        registerPage: store.registerPage.bind(store),
        createClientPage: store.createClientPage.bind(store),
        updatePage: store.updatePage.bind(store),
        updatePageFrontmatter: store.updatePageFrontmatter.bind(store),
        updatePageHtml: store.updatePageHtml.bind(store),
        resetPage: store.resetPage.bind(store),
        markPageForDeletion: store.markPageForDeletion.bind(store),
        unmarkPageForDeletion: store.unmarkPageForDeletion.bind(store),
        setDeletionToastCallback: store.setDeletionToastCallback.bind(store),
        emitPageSaveEvent: store.emitPageSaveEvent.bind(store),
        subscribePageSaveEvent: store.subscribePageSaveEvent.bind(store),
        emitNestedEditorUpdate: store.emitNestedEditorUpdate.bind(store),
        subscribeNestedEditorUpdate: store.subscribeNestedEditorUpdate.bind(store),
        handleCommitSuccess: store.handleCommitSuccess.bind(store)
    };
}

export function useNavigation(): NavigationSnapshotWithMethods {
    const store = useNavigationStore();
    const snapshot = useSyncExternalStore(
        store.subscribe.bind(store),
        store.getSnapshot.bind(store),
        store.getServerSnapshot.bind(store)
    );

    return createNavigationSnapshot(store, snapshot);
}

function useMaybeNavigationStore(): NavigationStore | null {
    const context = useContext(NavigationStoreContext);
    return context?.navigationStore || null;
}

export function useMaybeNavigation(): NavigationSnapshotWithMethods | null {
    const store = useMaybeNavigationStore();
    const snapshot = useSyncExternalStore(
        store?.subscribe.bind(store) || (() => () => null),
        store?.getSnapshot.bind(store) || (() => null),
        store?.getServerSnapshot.bind(store) || (() => null)
    );
    return store && snapshot ? createNavigationSnapshot(store, snapshot) : null;
}
