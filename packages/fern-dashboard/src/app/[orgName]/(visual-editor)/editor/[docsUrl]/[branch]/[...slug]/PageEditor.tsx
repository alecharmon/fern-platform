"use client";

import React, { useEffect, useRef, useState } from "react";

import type { Editor, EditorEvents } from "@tiptap/react";

import { getChangedNodesFromHtml } from "@fern-docs/mdx";

import TiptapEditor from "@/components/editor/TiptapEditor";
import { usePages } from "@/providers/PagesStoreContext";

export declare namespace PageEditor {
    export interface Props {
        className?: string;
        filename: string;
        initialHtml?: string;
    }
}

// SEE: https://tiptap.dev/docs/editor/getting-started/install/react
export default function PageEditor({ className, filename, initialHtml }: PageEditor.Props) {
    const editorRef = useRef<Editor | null>(null);
    const skipNormalUpdateBecauseUpdateIsFromDevPanel = useRef(false);
    const latestTiptapHtml = useRef<string>(initialHtml || "");
    const [saveCounter, setSaveCounter] = useState(0);

    const { updatePage, subscribeSaveEvent } = usePages();

    // Subscribe to save events
    useEffect(() => {
        const unsubscribe = subscribeSaveEvent((event) => {
            skipNormalUpdateBecauseUpdateIsFromDevPanel.current = true;
            editorRef.current?.commands.setContent(event.html);
            setSaveCounter((c) => {
                return c + 1;
            });
        });

        return unsubscribe;
    }, [filename, subscribeSaveEvent, latestTiptapHtml, editorRef, setSaveCounter]);

    function onTiptapEditorCreate(props: EditorEvents["create"]) {
        latestTiptapHtml.current = props.editor.getHTML();
        editorRef.current = props.editor;
    }

    function onTiptapEditorUpdate(props: EditorEvents["update"]) {
        const html = props.editor.getHTML();

        if (!skipNormalUpdateBecauseUpdateIsFromDevPanel.current) {
            const changedNodes = getChangedNodesFromHtml(latestTiptapHtml.current, html);

            updatePage(filename, {
                html,
                changedNodes
            });
        } else {
            skipNormalUpdateBecauseUpdateIsFromDevPanel.current = false;
        }

        latestTiptapHtml.current = html;
    }

    // TODO: add a loading state, possibly as a Suspense boundary
    return (
        <div key={saveCounter} className="relative">
            <TiptapEditor
                autofocus={true}
                className={className}
                initialContent={initialHtml || ""}
                onCreate={onTiptapEditorCreate}
                onUpdate={onTiptapEditorUpdate}
            />
        </div>
    );
}
