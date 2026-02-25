"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

export interface ThemeColorOverrides {
    accentPrimary: { dark: string | null; light: string | null };
    background: { dark: string | null; light: string | null };
    border: { dark: string | null; light: string | null };
    sidebarBackground: { dark: string | null; light: string | null };
    headerBackground: { dark: string | null; light: string | null };
    cardBackground: { dark: string | null; light: string | null };
}

interface ThemingPanelContextValue {
    isThemingPanelOpen: boolean;
    setThemingPanelOpen: (open: boolean) => void;
    colorOverrides: ThemeColorOverrides | null;
    setColorOverrides: (overrides: ThemeColorOverrides | null) => void;
    logoOverrideUrl: string | null;
    setLogoOverrideUrl: (url: string | null) => void;
}

const ThemingPanelContext = createContext<ThemingPanelContextValue>({
    isThemingPanelOpen: false,
    setThemingPanelOpen: () => {
        return;
    },
    colorOverrides: null,
    setColorOverrides: () => {
        return;
    },
    logoOverrideUrl: null,
    setLogoOverrideUrl: () => {
        return;
    }
});

export function ThemingPanelProvider({ children }: { children: ReactNode }) {
    const [isThemingPanelOpen, setIsThemingPanelOpen] = useState(false);
    const [colorOverrides, setColorOverridesState] = useState<ThemeColorOverrides | null>(null);
    const [logoOverrideUrl, setLogoOverrideUrlState] = useState<string | null>(null);

    const setThemingPanelOpen = useCallback((open: boolean) => {
        setIsThemingPanelOpen(open);
    }, []);

    const setColorOverrides = useCallback((overrides: ThemeColorOverrides | null) => {
        setColorOverridesState(overrides);
    }, []);

    const setLogoOverrideUrl = useCallback((url: string | null) => {
        setLogoOverrideUrlState(url);
    }, []);

    const value = useMemo(
        () => ({
            isThemingPanelOpen,
            setThemingPanelOpen,
            colorOverrides,
            setColorOverrides,
            logoOverrideUrl,
            setLogoOverrideUrl
        }),
        [
            isThemingPanelOpen,
            setThemingPanelOpen,
            colorOverrides,
            setColorOverrides,
            logoOverrideUrl,
            setLogoOverrideUrl
        ]
    );

    return <ThemingPanelContext.Provider value={value}>{children}</ThemingPanelContext.Provider>;
}

export function useThemingPanel() {
    return useContext(ThemingPanelContext);
}
