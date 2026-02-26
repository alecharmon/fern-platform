"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { UpsellFeature } from "./types";

interface UpsellContextValue {
    activeFeature: UpsellFeature | null;
    isOpen: boolean;
    openUpsell: (feature: UpsellFeature) => void;
    closeUpsell: () => void;
}

const UpsellContext = createContext<UpsellContextValue>({
    activeFeature: null,
    isOpen: false,
    openUpsell: () => {},
    closeUpsell: () => {}
});

export function UpsellProvider({ children }: { children: ReactNode }) {
    const [activeFeature, setActiveFeature] = useState<UpsellFeature | null>(null);

    const openUpsell = useCallback((feature: UpsellFeature) => {
        setActiveFeature(feature);
    }, []);

    const closeUpsell = useCallback(() => {
        setActiveFeature(null);
    }, []);

    const value = useMemo(
        () => ({
            activeFeature,
            isOpen: activeFeature !== null,
            openUpsell,
            closeUpsell
        }),
        [activeFeature, openUpsell, closeUpsell]
    );

    return <UpsellContext.Provider value={value}>{children}</UpsellContext.Provider>;
}

export function useUpsell() {
    return useContext(UpsellContext);
}
