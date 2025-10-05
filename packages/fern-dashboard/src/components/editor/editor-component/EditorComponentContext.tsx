"use client";

import type React from "react";
import { type ReactNode, createContext, useContext } from "react";

import type { KeyedAttributes } from "../editor-mdx-renderer/types";

export interface EditorComponentContextValue {
    keyedAttributes: KeyedAttributes;
    updateKeyedAttributes: (callback: (current: KeyedAttributes) => KeyedAttributes) => unknown;
    deleteSelf: () => unknown;
    isWithinEditor: boolean;
    index: number;
    newlyCreated?: boolean;
}

const EditorComponentContext = createContext<EditorComponentContextValue>({
    keyedAttributes: {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    updateKeyedAttributes: () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    deleteSelf: () => {},
    isWithinEditor: false,
    index: 0,
    newlyCreated: false
});
export const EditorComponentProvider: React.FC<
    EditorComponentContextValue & {
        children: ReactNode;
    }
> = ({ keyedAttributes, updateKeyedAttributes, deleteSelf, isWithinEditor, index, newlyCreated, children }) => {
    const value: EditorComponentContextValue = {
        keyedAttributes,
        updateKeyedAttributes,
        deleteSelf,
        isWithinEditor,
        index,
        newlyCreated
    };

    return <EditorComponentContext.Provider value={value}>{children}</EditorComponentContext.Provider>;
};

export const useEditorComponent = (): EditorComponentContextValue => {
    return useContext(EditorComponentContext);
};
