"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

export const DevModeContext = createContext<{
    panelOpen: boolean;
    setPanelOpen: (panelOpen: boolean) => void;
    isDevModeDisabled: boolean;
    setDevModeDisabled: (disabled: boolean) => void;
}>({
    panelOpen: false,
    setPanelOpen: (_panelOpen: boolean) => {
        return;
    },
    isDevModeDisabled: false,
    setDevModeDisabled: (_disabled: boolean) => {
        return;
    }
});

export function DevModeProvider({ children }: { children: ReactNode }) {
    const [panelOpen, setPanelOpenStore] = useState<boolean>(false);
    const [isDevModeDisabled, setDevModeDisabledStore] = useState<boolean>(false);

    const setPanelOpen = useCallback((panelOpen: boolean) => {
        setPanelOpenStore(panelOpen);
    }, []);

    const setDevModeDisabled = useCallback((disabled: boolean) => {
        setDevModeDisabledStore(disabled);
    }, []);

    const value = useMemo(
        () => ({ panelOpen, setPanelOpen, isDevModeDisabled, setDevModeDisabled }),
        [panelOpen, setPanelOpen, isDevModeDisabled, setDevModeDisabled]
    );

    return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>;
}

export function useDevMode() {
    return useContext(DevModeContext);
}
