"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

/** The type of page currently being viewed */
export type CurrentPageType = "docs" | "api-reference" | "changelog" | null;

export const DevModeContext = createContext<{
    panelOpen: boolean;
    setPanelOpen: (panelOpen: boolean) => void;
    isDevModeDisabled: boolean;
    setDevModeDisabled: (disabled: boolean) => void;
    currentPageType: CurrentPageType;
    setCurrentPageType: (type: CurrentPageType) => void;
    viewOnlyContentLoading: boolean;
    setViewOnlyContentLoading: (loading: boolean) => void;
}>({
    panelOpen: false,
    setPanelOpen: (_panelOpen: boolean) => {
        return;
    },
    isDevModeDisabled: false,
    setDevModeDisabled: (_disabled: boolean) => {
        return;
    },
    currentPageType: null,
    setCurrentPageType: (_type: CurrentPageType) => {
        return;
    },
    viewOnlyContentLoading: false,
    setViewOnlyContentLoading: (_loading: boolean) => {
        return;
    }
});

export function DevModeProvider({ children }: { children: ReactNode }) {
    const [panelOpen, setPanelOpenStore] = useState<boolean>(false);
    const [isDevModeDisabled, setDevModeDisabledStore] = useState<boolean>(false);
    const [currentPageType, setCurrentPageTypeStore] = useState<CurrentPageType>(null);
    const [viewOnlyContentLoading, setViewOnlyContentLoadingStore] = useState<boolean>(false);

    const setPanelOpen = useCallback((panelOpen: boolean) => {
        setPanelOpenStore(panelOpen);
    }, []);

    const setDevModeDisabled = useCallback((disabled: boolean) => {
        setDevModeDisabledStore(disabled);
    }, []);

    const setCurrentPageType = useCallback((type: CurrentPageType) => {
        setCurrentPageTypeStore(type);
    }, []);

    const setViewOnlyContentLoading = useCallback((loading: boolean) => {
        setViewOnlyContentLoadingStore(loading);
    }, []);

    const value = useMemo(
        () => ({
            panelOpen,
            setPanelOpen,
            isDevModeDisabled,
            setDevModeDisabled,
            currentPageType,
            setCurrentPageType,
            viewOnlyContentLoading,
            setViewOnlyContentLoading
        }),
        [
            panelOpen,
            setPanelOpen,
            isDevModeDisabled,
            setDevModeDisabled,
            currentPageType,
            setCurrentPageType,
            viewOnlyContentLoading,
            setViewOnlyContentLoading
        ]
    );

    return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>;
}

export function useDevMode() {
    return useContext(DevModeContext);
}
