"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
    latestDocsYmlAndReferences: Map<string, string> | null;
    fernFolderPath?: string;
    deletionToastCallback?: DeletionToastCallback;
}

export function NavigationStoreProvider({
    children,
    branchName,
    orgName,
    docsUrl,
    latestDocsYmlAndReferences,
    fernFolderPath,
    deletionToastCallback
}: NavigationStoreProviderProps) {
    const storeRef = useRef<NavigationStore>(new NavigationStore(branchName, orgName, docsUrl, fernFolderPath));

    if (
        !storeRef.current ||
        storeRef.current.branchName !== branchName ||
        storeRef.current.orgName !== orgName ||
        storeRef.current.docsUrl !== docsUrl ||
        storeRef.current.fernFolderPath !== fernFolderPath
    ) {
        storeRef.current = new NavigationStore(branchName, orgName, docsUrl, fernFolderPath);
    }

    useEffect(() => {
        void storeRef.current.hydrate({ latestDocsYmlAndReferences });
    }, [latestDocsYmlAndReferences]);

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
    rootNode: NavigationStore["rootNode"];
    registeredPages: NavigationStore["registeredPages"];
    files: NavigationStore["files"];
    resolveInitialPageData: NavigationStore["resolveInitialPageData"];
    registerPage: NavigationStore["registerPage"];
    createClientPage: NavigationStore["createClientPage"];
    createClientPageInNewSection: NavigationStore["createClientPageInNewSection"];
    updatePage: NavigationStore["updatePage"];
    updatePageFrontmatter: NavigationStore["updatePageFrontmatter"];
    updatePageHtml: NavigationStore["updatePageHtml"];
    resetPage: NavigationStore["resetPage"];
    markPageForDeletion: NavigationStore["markPageForDeletion"];
    unmarkPageForDeletion: NavigationStore["unmarkPageForDeletion"];
    renameSection: NavigationStore["renameSection"];
    renamePage: NavigationStore["renamePage"];
    setDeletionToastCallback: NavigationStore["setDeletionToastCallback"];
    setRootNode: NavigationStore["setRootNode"];
    emitPageSaveEvent: NavigationStore["emitPageSaveEvent"];
    subscribePageSaveEvent: NavigationStore["subscribePageSaveEvent"];
    emitNestedEditorUpdate: NavigationStore["emitNestedEditorUpdate"];
    subscribeNestedEditorUpdate: NavigationStore["subscribeNestedEditorUpdate"];
    handleCommitSuccess: NavigationStore["handleCommitSuccess"];
    // OpenAPI change properties and methods
    openApiPendingChanges: NavigationStore["openApiPendingChanges"];
    updateOpenApiChange: NavigationStore["updateOpenApiChange"];
    resetOpenApiChange: NavigationStore["resetOpenApiChange"];
    clearOpenApiChanges: NavigationStore["clearOpenApiChanges"];
    commitOpenApiChanges: NavigationStore["commitOpenApiChanges"];
};

function createNavigationSnapshot(store: NavigationStore, snapshot: NavigationSnapshot): NavigationSnapshotWithMethods {
    return {
        ...snapshot,
        _navigationStore: store,
        hydrated: store.hydrated,
        rootNode: store.rootNode,
        registeredPages: store.registeredPages,
        files: store.files,
        resolveInitialPageData: store.resolveInitialPageData.bind(store),
        registerPage: store.registerPage.bind(store),
        createClientPage: store.createClientPage.bind(store),
        createClientPageInNewSection: store.createClientPageInNewSection.bind(store),
        updatePage: store.updatePage.bind(store),
        updatePageFrontmatter: store.updatePageFrontmatter.bind(store),
        updatePageHtml: store.updatePageHtml.bind(store),
        resetPage: store.resetPage.bind(store),
        markPageForDeletion: store.markPageForDeletion.bind(store),
        unmarkPageForDeletion: store.unmarkPageForDeletion.bind(store),
        renameSection: store.renameSection.bind(store),
        renamePage: store.renamePage.bind(store),
        setDeletionToastCallback: store.setDeletionToastCallback.bind(store),
        setRootNode: store.setRootNode.bind(store),
        emitPageSaveEvent: store.emitPageSaveEvent.bind(store),
        subscribePageSaveEvent: store.subscribePageSaveEvent.bind(store),
        emitNestedEditorUpdate: store.emitNestedEditorUpdate.bind(store),
        subscribeNestedEditorUpdate: store.subscribeNestedEditorUpdate.bind(store),
        handleCommitSuccess: store.handleCommitSuccess.bind(store),
        // OpenAPI change properties and methods - explicitly from store to ensure latest values
        openApiPendingChanges: store.openApiPendingChanges,
        updateOpenApiChange: store.updateOpenApiChange.bind(store),
        resetOpenApiChange: store.resetOpenApiChange.bind(store),
        clearOpenApiChanges: store.clearOpenApiChanges.bind(store),
        commitOpenApiChanges: store.commitOpenApiChanges.bind(store)
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

/**
 * Preview-only version of NavigationStoreProvider that provides no-op navigation functionality.
 * Used when displaying docs in preview mode without GitHub integration.
 */
export function PreviewNavigationStoreProvider({
    children,
    branchName,
    orgName,
    docsUrl
}: {
    children: ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
}) {
    const [isHydrated, setIsHydrated] = useState(false);

    // Create a minimal navigation store in preview-only mode (skips docs.yml generation)
    const storeRef = useRef<NavigationStore>(new NavigationStore(branchName, orgName, docsUrl, undefined, true));

    if (
        !storeRef.current ||
        storeRef.current.branchName !== branchName ||
        storeRef.current.orgName !== orgName ||
        storeRef.current.docsUrl !== docsUrl
    ) {
        storeRef.current = new NavigationStore(branchName, orgName, docsUrl, undefined, true);
        setIsHydrated(false); // Reset hydration state when store changes
    }

    // Hydrate the store with null data so pages can be resolved from server-provided initial data
    useEffect(() => {
        storeRef.current.hydrate({ latestDocsYmlAndReferences: null }).then(() => {
            setIsHydrated(true);
        });
    }, []);

    // Don't render children until hydration is complete to avoid 404 flash
    if (!isHydrated) {
        return null;
    }

    return (
        <NavigationStoreContext.Provider value={{ navigationStore: storeRef.current }}>
            {children}
        </NavigationStoreContext.Provider>
    );
}
