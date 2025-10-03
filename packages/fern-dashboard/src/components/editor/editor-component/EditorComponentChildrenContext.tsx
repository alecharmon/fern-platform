"use client";

import React, { ReactNode, createContext, useContext } from "react";

interface EditorComponentChildrenContextValue {
    appendChildrenMdx: (newChild: string) => unknown;
    providedChildren: React.ReactElement;
}

const EditorComponentChildrenContext = createContext<EditorComponentChildrenContextValue>({
    // eslint-disable-next-line @typescript-eslint/no-empty-function
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
