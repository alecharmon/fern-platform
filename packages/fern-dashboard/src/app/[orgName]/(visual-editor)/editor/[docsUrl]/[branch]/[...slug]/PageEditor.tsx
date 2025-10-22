"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import { getChangedNodesFromHtml } from "@fern-docs/mdx";
import type { Transaction } from "@tiptap/pm/state";
import type { Editor, EditorEvents } from "@tiptap/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import TiptapEditor from "@/components/editor/TiptapEditor";
import { hasChangedContentInTransaction } from "@/components/editor/utils";

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
    const allowNormalUpdateBecauseChangesExist = useRef(false);
    const latestTiptapHtml = useRef<string>(initialHtml || "");
    const [saveCounter, setSaveCounter] = useState(0);

    const { updatePageHtml, subscribePageSaveEvent, subscribeNestedEditorUpdate } = useNavigation();

    // Shared logic for handling editor updates
    const handleEditorUpdate = useCallback(
        (html: string, transaction?: Transaction) => {
            const changedNodes = getChangedNodesFromHtml(latestTiptapHtml.current, html);

            // Recompute allowNormalUpdateBecauseChangesExist if we haven't detected changed nodes yet
            if (!allowNormalUpdateBecauseChangesExist.current && transaction) {
                // changedNodes only tracks changes to nodes that exist in original HTML
                const hasChangedNodes = Object.values(changedNodes).some((value) => value);

                // Check if net-new changes were added in the transaction
                const hasNewContent = hasChangedContentInTransaction(transaction);

                allowNormalUpdateBecauseChangesExist.current = hasChangedNodes || hasNewContent;
            }

            // Only update the page HTML if we have detected changed nodes or new content
            if (allowNormalUpdateBecauseChangesExist.current) {
                updatePageHtml(filename, html, changedNodes);
            }
            latestTiptapHtml.current = html;
        },
        [filename, updatePageHtml]
    );

    // Subscribe to save events
    useEffect(() => {
        const unsubscribe = subscribePageSaveEvent((event) => {
            if (event.filename === filename) {
                // Always allow update when the page is saved from Dev Mode
                allowNormalUpdateBecauseChangesExist.current = true;

                // Update latestTiptapHtml before setSaveCounter so new editor mounts with correct initialContent
                latestTiptapHtml.current = event.html;
                setSaveCounter((c) => c + 1);
            }
        });

        return () => {
            allowNormalUpdateBecauseChangesExist.current = false;
            unsubscribe();
        };
    }, [filename, subscribePageSaveEvent]);

    // Subscribe to nested editor update events
    useEffect(() => {
        const unsubscribe = subscribeNestedEditorUpdate((event) => {
            if (event.filename === filename && editorRef.current) {
                const html = editorRef.current.getHTML();
                handleEditorUpdate(html, event.transaction as Transaction);
            }
        });

        return unsubscribe;
    }, [filename, subscribeNestedEditorUpdate, handleEditorUpdate]);

    function onTiptapEditorCreate(props: EditorEvents["create"]) {
        latestTiptapHtml.current = props.editor.getHTML();
        editorRef.current = props.editor;
    }

    function onTiptapEditorUpdate(props: EditorEvents["update"]) {
        const html = props.editor.getHTML();
        handleEditorUpdate(html, props.transaction);
    }

    // TODO: add a loading state, possibly as a Suspense boundary
    return (
        <div key={saveCounter} className="relative">
            <TiptapEditor
                className={className}
                initialContent={latestTiptapHtml.current}
                onCreate={onTiptapEditorCreate}
                onUpdate={onTiptapEditorUpdate}
            />
        </div>
    );
}
