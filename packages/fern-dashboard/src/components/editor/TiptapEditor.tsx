"use client";

import { useEffect } from "react";

import CodeBlock from "@tiptap/extension-code-block";
import Placeholder from "@tiptap/extension-placeholder";
import {
  EditorContent,
  EditorProvider,
  EditorProviderProps,
  Extension,
  ReactNodeViewRenderer,
  useCurrentEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { all, createLowlight } from "lowlight";

import "@/components/editor/tiptap-node/node-focus/node-focus.scss";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useEditor } from "@/providers/EditorContext";
import { cn } from "@/utils/utils";

import BubbleMenu from "./BubbleMenu";
import FloatingMenu from "./FloatingMenu";
import NodeHoverHandle from "./NodeHoverHandle";
import CodeBlockComponent from "./extension-code-block/CodeBlockComponent";
import CustomElement from "./extension-custom-element";
import { FVEAttributesExtension } from "./extension-fve-attributes";
import { LowlightPlugin } from "./tiptap-node/lowlight/lowlight-plugin";
import {
  ConfiguredFileHandler,
  ConfiguredMediaUploadNode,
} from "./tiptap-node/media-upload-node/configured-upload-extensions";

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

const lowlight = createLowlight(all);

// Configure Tiptap extensions
const extensions = [
  StarterKit.configure({
    dropcursor: {
      color: "var(--grayscale-a11)",
    },
    gapcursor: false,
    codeBlock: false,
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
  CodeBlock.configure({ enableTabIndentation: true }).extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockComponent);
    },
    addProseMirrorPlugins() {
      return [
        LowlightPlugin({ name: "codeBlock", lowlight, defaultLanguage: null }),
      ];
    },
  }),
] as Extension[];
export declare namespace TiptapEditor {
  export interface Props {
    autofocus?: boolean;
    className?: string;
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
}: TiptapEditor.Props) {
  const isEditingDisabled = useEditingDisabled();

  return (
    <EditorProvider
      autofocus={autofocus}
      extensions={[
        ...extensions,
        ConfiguredMediaUploadNode(),
        ConfiguredFileHandler(),
      ]}
      editorProps={{
        attributes: {
          class: "prose prose-md focus:outline-none max-w-none p-4",
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
      onFocus={({ editor }) => {
        // Clear selection from all other ProseMirror editors when this editor is focused
        const allEditors = document.querySelectorAll(".ProseMirror");
        allEditors.forEach((editorElement) => {
          if (editorElement !== editor.view.dom) {
            // Clear selection by removing ProseMirror-selectednode class from all nodes in other editors
            const selectedNodes = editorElement.querySelectorAll(
              ".ProseMirror-selectednode"
            );
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
        {!isEditingDisabled && <FloatingMenu />}
        {!isEditingDisabled && <BubbleMenu />}
        <EditorContent editor={null} />
      </div>
      <EditorContextUpdater />
      <TipTapEditingDisabledListener />
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
