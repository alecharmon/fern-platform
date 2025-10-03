"use client";

import { createContext, useCallback, useContext, useState } from "react";

import { Editor } from "@tiptap/react";

/**
 * This context is used to store the editor instance and provide it to the components that need it.
 * We attempted to use the EditorProvider from @tiptap/react, but it was causing issues with the undo/redo history.
 * Specifically, it would add an extra undo/redo step when the editor was created, where clicking undo immediately
 * after mount would undo the initial content (i.e. delete the entire document).
 *
 * This context is a simple wrapper around the EditorProvider from @tiptap/react, but it does not use the EditorProvider
 * and instead stores the editor instance in a state variable.
 */
interface EditorContextType {
    editor: Editor | null;
    setEditor: (editor: Editor | null) => void;
}

const EditorContext = createContext<EditorContextType>({
    editor: null,
    setEditor: () => undefined
});

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error("useEditor must be used within an EditorProvider");
    }
    return context;
};

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const [editor, setEditorState] = useState<Editor | null>(null);

    const setEditor = useCallback((newEditor: Editor | null) => {
        setEditorState(newEditor);
    }, []);

    return <EditorContext.Provider value={{ editor, setEditor }}>{children}</EditorContext.Provider>;
}
