"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import { getChangedNodesFromHtml } from "@fern-docs/mdx";
import type { Transaction } from "@tiptap/pm/state";
import type { Editor, EditorEvents } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

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
    const latestTiptapHtml = useRef<string>(initialHtml || "");
    // Track node IDs that have ever been changed during this editing session
    // Once a node is marked as changed, it stays changed to avoid reverting edits
    const dirtyNodeIds = useRef<Set<string>>(new Set());
    const [saveCounter, setSaveCounter] = useState(0);

    const { updatePageHtml, subscribePageSaveEvent, subscribeNestedEditorUpdate } = useNavigation();

    // Shared logic for handling editor updates
    const handleEditorUpdate = useCallback(
        (html: string, transaction?: Transaction) => {
            const changedNodes = getChangedNodesFromHtml(latestTiptapHtml.current, html);

            // Mark any changed nodes as permanently dirty for this session
            Object.entries(changedNodes).forEach(([nodeId, isChanged]) => {
                if (isChanged) {
                    dirtyNodeIds.current.add(nodeId);
                }
            });

            // Merge the current changes with the accumulated dirty nodes
            // A node is considered changed if it's changed in this update OR was changed before
            const accumulatedChangedNodes = { ...changedNodes };
            dirtyNodeIds.current.forEach((nodeId) => {
                accumulatedChangedNodes[nodeId] = true;
            });

            updatePageHtml(filename, html, accumulatedChangedNodes);
            latestTiptapHtml.current = html;
        },
        [filename, updatePageHtml]
    );

    // Subscribe to save events
    useEffect(() => {
        const unsubscribe = subscribePageSaveEvent((event) => {
            if (event.filename === filename) {
                // Update latestTiptapHtml before setSaveCounter so new editor mounts with correct initialContent
                latestTiptapHtml.current = event.html;
                setSaveCounter((c) => c + 1);
            }
        });

        return () => {
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

    function placeCaretAtFirstTextblock(editor: Editor) {
        const { doc } = editor.state;
        let pos: number | null = null;
        doc.descendants((node, posHere) => {
            if (node.isTextblock) {
                pos = posHere + 1;
                return false;
            }
            return true;
        });
        if (pos != null) {
            editor.commands.setTextSelection(pos);
        } else {
            editor.commands.setTextSelection(doc.content.size);
        }
    }

    function onTiptapEditorCreate(props: EditorEvents["create"]) {
        latestTiptapHtml.current = props.editor.getHTML();
        editorRef.current = props.editor;

        requestAnimationFrame(() => {
            const firstNode = props.editor.state.doc.firstChild;
            if (firstNode?.type?.name === "custom-element-v2") {
                placeCaretAtFirstTextblock(props.editor);
            }
        });
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
