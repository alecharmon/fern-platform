"use client";

import React, { useEffect, useRef, useState } from "react";

import type { Editor, EditorEvents } from "@tiptap/react";

import { useNavigation } from "@fern-docs/components/navigation";
import { getChangedNodesFromHtml } from "@fern-docs/mdx";

import TiptapEditor from "@/components/editor/TiptapEditor";

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
    const skipFirstUpdateBecauseItIsInitialization = useRef(true);
    const latestTiptapHtml = useRef<string>(initialHtml || "");
    const [saveCounter, setSaveCounter] = useState(0);

    const { updatePageHtml, subscribePageSaveEvent } = useNavigation();

    // Subscribe to save events
    useEffect(() => {
        const unsubscribe = subscribePageSaveEvent((event) => {
            if (event.filename === filename) {
                skipNormalUpdateBecauseUpdateIsFromDevPanel.current = true;
                editorRef.current?.commands.setContent(event.html);
                setSaveCounter((c) => c + 1);
            }
        });

        return unsubscribe;
    }, [filename, subscribePageSaveEvent, latestTiptapHtml, editorRef, setSaveCounter]);

    // Reset initialization flag when the editor is recreated (e.g., from dev panel updates)
    useEffect(() => {
        skipFirstUpdateBecauseItIsInitialization.current = true;
    }, [saveCounter]);

    function onTiptapEditorCreate(props: EditorEvents["create"]) {
        latestTiptapHtml.current = props.editor.getHTML();
        editorRef.current = props.editor;
    }

    function onTiptapEditorUpdate(props: EditorEvents["update"]) {
        const html = props.editor.getHTML();

        // Skip the first update event as it's just TipTap processing the initial content
        if (skipFirstUpdateBecauseItIsInitialization.current) {
            skipFirstUpdateBecauseItIsInitialization.current = false;
            latestTiptapHtml.current = html;
            return;
        }

        if (!skipNormalUpdateBecauseUpdateIsFromDevPanel.current) {
            const changedNodes = getChangedNodesFromHtml(latestTiptapHtml.current, html);
            updatePageHtml(filename, html, changedNodes);
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
                initialContent={latestTiptapHtml.current}
                onCreate={onTiptapEditorCreate}
                onUpdate={onTiptapEditorUpdate}
            />
        </div>
    );
}
