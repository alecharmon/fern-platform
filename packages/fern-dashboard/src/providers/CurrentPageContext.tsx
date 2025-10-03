"use client";

import { ReactNode, createContext, useContext, useState } from "react";

export const CurrentPageContext = createContext<{
    currentFilename: string | null;
    setCurrentFilename: (filename: string) => void;
}>({
    currentFilename: null,
    setCurrentFilename: () => {
        return;
    }
});

export function CurrentPageProvider({ children }: { children: ReactNode }) {
    const [currentFilename, setCurrentFilename] = useState<string | null>(null);

    return (
        <CurrentPageContext.Provider value={{ currentFilename, setCurrentFilename }}>
            {children}
        </CurrentPageContext.Provider>
    );
}

export function useCurrentPage() {
    return useContext(CurrentPageContext);
}
