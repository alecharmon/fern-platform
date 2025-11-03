"use client";

import CodeBlock from "@tiptap/extension-code-block";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableHeader, TableKit, TableRow } from "@tiptap/extension-table";
import {
    EditorProvider,
    type EditorProviderProps,
    type Extension,
    ReactNodeViewRenderer,
    useCurrentEditor
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";

import "@/components/editor/tiptap-node/node-focus/node-focus.scss";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useEditor } from "@/providers/EditorContext";
import { cn } from "@/utils/utils";
import { createCodeBlockComponent } from "./extension-code-block/CodeBlockComponent";
import CustomElement from "./extension-custom-element";
import { FVEAttributesExtension } from "./extension-fve-attributes";
import { MarkdownPasteExtension } from "./extension-markdown-paste";
import { SelectBlockExtension } from "./extension-select-block/select-block-extension";
import FloatingMenu from "./FloatingMenu";
import NodeHoverHandle from "./NodeHoverHandle";
import TableNodeView from "./TableNodeView";
import TextBubbleMenu from "./TextBubbleMenu";
import TableHeaderNodeView from "./table/TableHeaderNodeView";
import TableRowNodeView from "./table/TableRowNodeView";
import {
    ConfiguredFileHandler,
    ConfiguredMediaUploadNode
} from "./tiptap-node/media-upload-node/configured-upload-extensions";
import { ShikiPlugin } from "./tiptap-node/shiki/shiki-plugin";

// These node types are the ones that will have data attributes set on them
const dataAttributeNodeTypes = [
    "div",
    "img",
    "doc",
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "hardBreak",
    "horizontalRule",
    "bulletList",
    "orderedList",
    "listItem"
];

// Configure Tiptap extensions
const extensions = [
    StarterKit.configure({
        dropcursor: {
            color: "var(--grayscale-a11)"
        },
        heading: {
            levels: [1, 2, 3, 4, 5, 6]
        },
        gapcursor: false,
        codeBlock: false,
        link: false
    }),
    Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
            class: "fern-mdx-link"
        }
    }),
    FVEAttributesExtension.configure({
        types: dataAttributeNodeTypes
    }),
    MarkdownPasteExtension,
    SelectBlockExtension,
    CustomElement,
    Placeholder.configure({
        placeholder: "Write or press `/` for components",
        emptyEditorClass: "is-empty",
        emptyNodeClass: "is-empty"
    }),
    CodeBlock.configure({ enableTabIndentation: true }).extend({
        addNodeView() {
            return ReactNodeViewRenderer(createCodeBlockComponent());
        },
        addProseMirrorPlugins() {
            return [ShikiPlugin({ name: "codeBlock", defaultLanguage: null })];
        }
    }),
    Table.extend({
        addNodeView() {
            return ReactNodeViewRenderer(TableNodeView, { as: "table" });
        },
        addKeyboardShortcuts() {
            return {
                "Mod-a": ({ editor }) => {
                    if (editor.isDestroyed) return false;

                    // If we're inside a table cell, override the default to only select the cell content
                    // AI generated:
                    const { selection, doc } = editor.state;
                    const { $from } = selection;
                    const docSize = doc.content.size;

                    for (let d = $from.depth; d > 0; d--) {
                        const node = $from.node(d);
                        if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                            const cellStart = $from.before(d) + 1;
                            const cellEnd = $from.after(d) - 1;

                            const from = Math.min(Math.max(cellStart, 0), docSize);
                            const to = Math.min(Math.max(cellEnd, 0), docSize);

                            if (from <= to) {
                                try {
                                    editor.commands.setTextSelection({ from, to });
                                    return true;
                                } catch (error) {
                                    console.warn("Failed to set selection in table cell:", error);
                                    return false;
                                }
                            }
                            return false;
                        }
                    }

                    // If not in a table cell, use default behavior
                    return false;
                }
            };
        }
    }),
    TableRow.extend({
        addNodeView() {
            return ReactNodeViewRenderer(TableRowNodeView, {
                as: "tr"
            });
        }
    }),
    TableHeader.extend({
        addNodeView() {
            return ReactNodeViewRenderer(TableHeaderNodeView, {
                as: "th",
                className: "fern-table-header"
            });
        }
    }),
    TableKit.configure({
        table: false,
        tableRow: false,
        tableHeader: false
    })
] as Extension[];
export declare namespace TiptapEditor {
    export interface Props {
        autofocus?: boolean;
        className?: string;
        disableDragging?: boolean;
        initialContent: string;
        onCreate?: EditorProviderProps["onCreate"];
        onUpdate?: EditorProviderProps["onUpdate"];
    }
}

// SEE: https://tiptap.dev/docs/editor/getting-started/install/react
export default function TiptapEditor({
    autofocus,
    className,
    initialContent,
    onCreate,
    onUpdate,
    disableDragging
}: TiptapEditor.Props) {
    const isEditingDisabled = useEditingDisabled();
    const skipFirstUpdateRef = useRef(true);

    // Generate a unique ID for this editor instance to prevent cross-editor drag-and-drop
    const editorId = useMemo(() => Math.random().toString(36).slice(2), []);

    const handleUpdate: EditorProviderProps["onUpdate"] = (props) => {
        // Skip the first update event as it's always just processing the initial content
        if (skipFirstUpdateRef.current) {
            skipFirstUpdateRef.current = false;
            return;
        }

        onUpdate?.(props);
    };

    return (
        <EditorProvider
            autofocus={autofocus}
            extensions={[...extensions, ConfiguredMediaUploadNode(), ConfiguredFileHandler()]}
            editorProps={{
                attributes: {
                    class: "focus:outline-none max-w-none p-4",
                    // Attach editor ID to DOM for cross-editor drag detection
                    "data-editor-id": editorId
                },
                handleDOMEvents: {
                    // Block drops from other editors (e.g., outer → nested or vice versa) by comparing editor IDs
                    drop: (view, event) => {
                        const e = event as unknown as DragEvent;
                        const fromId = e.dataTransfer?.getData("editor-id") || "";
                        const toId = (view.dom as HTMLElement)?.getAttribute("data-editor-id") || "";
                        if (fromId && toId && fromId !== toId) {
                            e.preventDefault();
                            e.stopPropagation();
                            return true;
                        }
                        return false;
                    },
                    // Show "not-allowed" cursor when dragging between different editors
                    dragover: (view, event) => {
                        const e = event as unknown as DragEvent;
                        const fromId = e.dataTransfer?.getData("editor-id") || "";
                        const toId = (view.dom as HTMLElement)?.getAttribute("data-editor-id") || "";
                        if (fromId && toId && fromId !== toId) {
                            try {
                                if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
                            } catch {}
                            e.preventDefault();
                            e.stopPropagation();
                            return true;
                        }
                        return false;
                    }
                }
            }}
            parseOptions={{
                // Required to preserve formatting in custom element previews
                preserveWhitespace: true
            }}
            content={initialContent}
            editorContainerProps={{
                className: cn(className, "relative")
            }}
            onCreate={onCreate}
            onUpdate={handleUpdate}
            onFocus={({ editor }) => {
                // Clear selection from all other ProseMirror editors when this editor is focused
                const allEditors = document.querySelectorAll(".ProseMirror");
                allEditors.forEach((editorElement) => {
                    if (editorElement !== editor.view.dom) {
                        // Clear selection by removing ProseMirror-selectednode class from all nodes in other editors
                        const selectedNodes = editorElement.querySelectorAll(".ProseMirror-selectednode");
                        selectedNodes.forEach((node) => {
                            node.classList.remove("ProseMirror-selectednode");
                        });
                    }
                });
            }}
        >
            <div>
                {/* DEV NOTE: The floating menu and bubble menu MUST be rendered before the editor content to reconcile
        a dom bug with tiptap's floating menus.
        Context here: https://github.com/ueberdosis/tiptap/issues/4619#issuecomment-1869042861 */}
                {!isEditingDisabled && !disableDragging && <NodeHoverHandle />}
                {!isEditingDisabled && <FloatingMenu />}
                {!isEditingDisabled && <TextBubbleMenu />}
            </div>
            <EditorContextUpdater />
            <TipTapEditingDisabledListener />
        </EditorProvider>
    );
}

function EditorContextUpdater() {
    const { editor } = useCurrentEditor();
    const { setEditor } = useEditor();

    // Update the shared editor context when the Tiptap editor instance changes
    useEffect(() => {
        setEditor(editor);

        // Cleanup when component unmounts or editor changes
        return () => {
            setEditor(null);
        };
    }, [editor, setEditor]);

    return <></>;
}

function TipTapEditingDisabledListener() {
    const { editor } = useCurrentEditor();
    const isEditingDisabled = useEditingDisabled();

    // Ensure the editor stays in sync with editability status
    useEffect(() => {
        if (isEditingDisabled) {
            editor?.setEditable(false, false);
        } else {
            editor?.setEditable(true, false);
        }
    }, [isEditingDisabled, editor]);

    return <></>;
}
