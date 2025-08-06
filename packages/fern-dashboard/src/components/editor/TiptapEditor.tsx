"use client";

import { useEffect, useRef } from "react";

import Placeholder from "@tiptap/extension-placeholder";
import {
  EditorProvider,
  EditorProviderProps,
  Extension,
  useCurrentEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import BubbleMenu from "./BubbleMenu";
import FloatingMenu from "./FloatingMenu";
import CustomElement from "./extension-custom-element";
import GlobalDataHashAttribute from "./extension-global-data-hash-attribute";

// Configure Tiptap extensions
const extensions = [
  StarterKit,
  CustomElement,
  GlobalDataHashAttribute,
  Placeholder.configure({
    placeholder: "Write or press `/` for components",
    emptyEditorClass: "is-empty",
    emptyNodeClass: "is-empty",
  }),
] as Extension[];
export declare namespace TiptapEditor {
  export interface Props {
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
  className,
  disableFloatingMenu,
  disableBubbleMenu,
  content,
  onCreate,
  onUpdate,
}: TiptapEditor.Props) {
  return (
    <EditorProvider
      extensions={extensions}
      content={content}
      editorProps={{
        attributes: {
          class: "prose prose-md m-5 focus:outline-none max-w-none",
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
      <TipTapContentUpdateListener content={content} />
      {!disableFloatingMenu && <FloatingMenu />}
      {!disableBubbleMenu && <BubbleMenu />}
    </EditorProvider>
  );
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
