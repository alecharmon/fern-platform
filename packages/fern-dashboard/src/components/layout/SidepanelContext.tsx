"use client";

import { usePathname } from "next/navigation";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SidepanelContent = ReactNode | null;

interface SidepanelContextType {
    content: SidepanelContent;
    setContent: (content: SidepanelContent) => void;
    clear: () => void;
}

const SidepanelContext = createContext<SidepanelContextType | undefined>(undefined);

export function SidepanelProvider({ children }: { children: ReactNode }) {
    const [content, setContent] = useState<SidepanelContent>(null);
    const pathname = usePathname();

    useEffect(() => {
        setContent(null);
    }, [pathname]);

    const clear = useCallback(() => {
        setContent(null);
    }, []);
    const value = useMemo(() => ({ content, setContent, clear }), [content, clear]);

    return <SidepanelContext.Provider value={value}>{children}</SidepanelContext.Provider>;
}

export function useSidepanel() {
    const context = useContext(SidepanelContext);
    if (!context) {
        throw new Error("useSidepanel must be used within a SidepanelProvider");
    }
    return context;
}
