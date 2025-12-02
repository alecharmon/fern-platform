"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export const EditorPreviewContext = createContext<{
    isPreviewMode: boolean;
    setIsPreviewMode: (isPreviewMode: boolean) => void;
}>({
    isPreviewMode: false,
    setIsPreviewMode: (_isPreviewMode: boolean) => {
        return;
    }
});

export function EditorPreviewProvider({ isPreview, children }: { isPreview: boolean; children: ReactNode }) {
    const [isPreviewMode, setIsPreviewModeStore] = useState<boolean>(isPreview);

    const value = useMemo(() => ({ isPreviewMode, setIsPreviewMode: setIsPreviewModeStore }), [isPreviewMode]);

    return <EditorPreviewContext.Provider value={value}>{children}</EditorPreviewContext.Provider>;
}

export function useIsPreviewMode() {
    return useContext(EditorPreviewContext);
}
