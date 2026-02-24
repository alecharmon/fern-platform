"use client";

import type React from "react";
import { createContext, type ReactNode, useContext } from "react";

interface EditorComponentChildrenContextValue {
    appendChildrenMdx: (newChild: string) => unknown;
    providedChildren: React.ReactElement;
}

const EditorComponentChildrenContext = createContext<EditorComponentChildrenContextValue>({
    appendChildrenMdx: () => {},
    providedChildren: <></>
});

export const EditorComponentChildrenProvider: React.FC<
    EditorComponentChildrenContextValue & {
        children: ReactNode;
    }
> = ({ appendChildrenMdx, providedChildren, children }) => {
    const value: EditorComponentChildrenContextValue = {
        appendChildrenMdx,
        providedChildren
    };

    return <EditorComponentChildrenContext.Provider value={value}>{children}</EditorComponentChildrenContext.Provider>;
};

export const useEditorComponentChildren = (): EditorComponentChildrenContextValue => {
    return useContext(EditorComponentChildrenContext);
};

export const InterceptedChildren = () => {
    const { providedChildren } = useContext(EditorComponentChildrenContext);
    return providedChildren;
};
