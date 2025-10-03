"use client";

import React, { createContext, useContext } from "react";

interface EditorRoutingContextValue {
    orgName: string;
    docsUrl: string;
    branch: string;
}

const EditorRoutingContext = createContext<EditorRoutingContextValue | null>(null);

export function EditorRoutingProvider({
    children,
    value
}: {
    children: React.ReactNode;
    value: EditorRoutingContextValue;
}) {
    return <EditorRoutingContext.Provider value={value}>{children}</EditorRoutingContext.Provider>;
}

export function useEditorRouting() {
    const context = useContext(EditorRoutingContext);
    if (!context) {
        throw new Error("useEditorRouting must be used within EditorRoutingProvider");
    }
    return context;
}
