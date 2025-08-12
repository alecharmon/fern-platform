"use client";

import { useEffect, useRef } from "react";

import Placeholder from "@tiptap/extension-placeholder";
import UniqueID from "@tiptap/extension-unique-id";
import {
  EditorProvider,
  EditorProviderProps,
  Extension,
  useCurrentEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { useEditor } from "@/providers/EditorContext";

import BubbleMenu from "./BubbleMenu";
import FloatingMenu from "./FloatingMenu";
import NodeHoverHandle from "./NodeHoverHandle";
import CustomElement from "./extension-custom-element";
import GlobalDataHashAttribute from "./extension-global-data-hash-attribute";

// These node types are the ones that will have data attributes set on them
const dataAttributeNodeTypes = [
  "doc",
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "bulletList",
  "orderedList",
  "listItem",
];

// Configure Tiptap extensions
const extensions = [
  StarterKit,
  CustomElement,
  UniqueID.configure({
    types: dataAttributeNodeTypes,
  }),
  GlobalDataHashAttribute.configure({
    types: dataAttributeNodeTypes,
  }),
  Placeholder.configure({
    placeholder: "Write or press `/` for components",
    emptyEditorClass: "is-empty",
    emptyNodeClass: "is-empty",
  }),
] as Extension[];
export declare namespace TiptapEditor {
  export interface Props {
    autofocus?: boolean;
    className?: string;
    disableFloatingMenu?: boolean;
    disableBubbleMenu?: boolean;
    content?: EditorProviderProps["content"];
    onCreate?: EditorProviderProps["onCreate"];
    onUpdate?: EditorProviderProps["onUpdate"];
  }
}

// SEE: https://tiptap.dev/docs/editor/getting-started/install/react
export default function TiptapEditor({
  autofocus,
  className,
  disableFloatingMenu,
  disableBubbleMenu,
  content,
  onCreate,
  onUpdate,
}: TiptapEditor.Props) {
  return (
    <EditorProvider
      autofocus={autofocus}
      extensions={extensions}
      content={content}
      editorProps={{
        attributes: {
          class: "prose prose-md p-7 -m-2 focus:outline-none max-w-none",
        },
      }}
      parseOptions={{
        // Required to preserve formatting in custom element previews
        preserveWhitespace: true,
      }}
      editorContainerProps={{ className }}
      immediatelyRender={false}
      onCreate={onCreate}
      onUpdate={onUpdate}
    >
      <EditorContextUpdater />
      <TipTapContentUpdateListener content={content} />
      {!disableFloatingMenu && <FloatingMenu />}
      {!disableBubbleMenu && <BubbleMenu />}
      <NodeHoverHandle />
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

function TipTapContentUpdateListener({
  content,
}: {
  content: EditorProviderProps["content"];
}) {
  const { editor } = useCurrentEditor();
  const lastSetContentRef = useRef<string | null>(null);

  // Monitor content changes and update editor imperatively when needed
  useEffect(() => {
    if (!editor) return;
    // Don't update if the editor is focused (user is typing)
    if (editor.isFocused) return;
    const contentStr =
      typeof content === "string" ? content : JSON.stringify(content);

    if (!contentStr) return;

    const currContent = editor.getHTML();

    // Don't update if this content was the last thing we set
    // This prevents infinite loops when user types in editor
    if (lastSetContentRef.current === contentStr) {
      return;
    }

    if (contentStr !== currContent) {
      lastSetContentRef.current = contentStr;
      editor.commands.setContent(contentStr, {
        emitUpdate: false, // Don't emit update events since we don't want to trigger the onUpdate callback
      });
    }
  }, [content, editor]);

  return <></>;
}
