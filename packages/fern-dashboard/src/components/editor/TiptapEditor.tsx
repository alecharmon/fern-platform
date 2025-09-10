"use client";

import { useEffect } from "react";

import Placeholder from "@tiptap/extension-placeholder";
import {
  EditorProvider,
  EditorProviderProps,
  Extension,
  useCurrentEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import "@/components/editor/tiptap-node/node-focus/node-focus.scss";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useEditor } from "@/providers/EditorContext";
import { cn } from "@/utils/utils";

import BubbleMenu from "./BubbleMenu";
import FloatingMenu from "./FloatingMenu";
import NodeHoverHandle from "./NodeHoverHandle";
import CustomElement from "./extension-custom-element";
import { FVEAttributesExtension } from "./extension-fve-attributes";
import {
  ConfiguredFileHandler,
  ConfiguredImageUploadNode,
} from "./tiptap-node/image-upload-node/configured-upload-extensions";

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
  "listItem",
];

// Configure Tiptap extensions
const extensions = [
  StarterKit.configure({
    dropcursor: {
      color: "var(--grayscale-a11)",
    },
    gapcursor: false,
  }),
  FVEAttributesExtension.configure({
    types: dataAttributeNodeTypes,
  }),
  CustomElement,
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
    initialContent: string;
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
  initialContent,
  onCreate,
  onUpdate,
}: TiptapEditor.Props) {
  const isEditingDisabled = useEditingDisabled();

  return (
    <EditorProvider
      autofocus={autofocus}
      extensions={[
        ...extensions,
        ConfiguredImageUploadNode(),
        ConfiguredFileHandler(),
      ]}
      editorProps={{
        attributes: {
          class: "prose prose-md p-7 -m-2 focus:outline-none max-w-none",
        },
      }}
      parseOptions={{
        // Required to preserve formatting in custom element previews
        preserveWhitespace: true,
      }}
      content={initialContent}
      editorContainerProps={{
        className: cn(className, "relative"),
      }}
      immediatelyRender={false}
      onCreate={onCreate}
      onUpdate={onUpdate}
    >
      <EditorContextUpdater />
      <TipTapEditingDisabledListener />
      {!disableFloatingMenu && !isEditingDisabled && <FloatingMenu />}
      {!disableBubbleMenu && !isEditingDisabled && <BubbleMenu />}
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
