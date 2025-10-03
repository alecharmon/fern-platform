"use client";

import { ReactNode, createContext, useContext, useRef, useSyncExternalStore } from "react";

import { NavigationSnapshot, NavigationStore } from "./NavigationStore";

export type { NavigationSnapshot };

interface NavigationStoreContextValue {
    navigationStore: NavigationStore;
}

const NavigationStoreContext = createContext<NavigationStoreContextValue | null>(null);

export interface NavigationStoreProviderProps {
    children: ReactNode;
    branchName: string;
    orgName: string;
    docsUrl: string;
}

export function NavigationStoreProvider({ children, branchName, orgName, docsUrl }: NavigationStoreProviderProps) {
    const storeRef = useRef<NavigationStore>(new NavigationStore(branchName, orgName, docsUrl));

    if (
        !storeRef.current ||
        storeRef.current.branchName !== branchName ||
        storeRef.current.orgName !== orgName ||
        storeRef.current.docsUrl !== docsUrl
    ) {
        storeRef.current = new NavigationStore(branchName, orgName, docsUrl);
    }

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

export function useNavigation(): NavigationSnapshot & {
    _navigationStore: NavigationStore;
    loadClientPageData: NavigationStore["loadClientPageData"];
} {
    const store = useNavigationStore();
    const snapshot = useSyncExternalStore(
        store.subscribe.bind(store),
        store.getSnapshot.bind(store),
        store.getServerSnapshot.bind(store)
    );

    return {
        ...snapshot,
        _navigationStore: store,
        loadClientPageData: store.loadClientPageData.bind(store)
    };
}

function useSafeNavigationStore(): NavigationStore | null {
    const context = useContext(NavigationStoreContext);
    return context?.navigationStore || null;
}

export function useSafeNavigation():
    | (NavigationSnapshot & {
          _navigationStore: NavigationStore | null;
          loadClientPageData?: NavigationStore["loadClientPageData"];
      })
    | null {
    const store = useSafeNavigationStore();
    const snapshot = useSyncExternalStore(
        store?.subscribe.bind(store) || (() => () => null),
        store?.getSnapshot.bind(store) || (() => null),
        store?.getServerSnapshot.bind(store) || (() => null)
    );

    if (!store || !snapshot) {
        return null;
    }

    return {
        ...snapshot,
        _navigationStore: store,
        loadClientPageData: store.loadClientPageData.bind(store)
    };
}
