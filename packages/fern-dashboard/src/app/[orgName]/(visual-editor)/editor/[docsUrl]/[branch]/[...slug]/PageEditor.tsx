"use client";

import React, { useEffect, useRef } from "react";

import { Editor, EditorEvents } from "@tiptap/react";

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
export default function PageEditor({
  className,
  filename,
  initialHtml,
}: PageEditor.Props) {
  const editorRef = useRef<Editor | null>(null);
  const latestTiptapHtml = useRef<string>(initialHtml || "");

  const { updatePage, subscribeSaveEvent } = usePages();

  // Subscribe to save events
  useEffect(() => {
    const unsubscribe = subscribeSaveEvent((event) => {
      if (event.fileName === filename) {
        editorRef.current?.commands.setContent(event.html);
        latestTiptapHtml.current = event.html;
      }
    });

    return unsubscribe;
  }, [filename, subscribeSaveEvent]);

  function onTiptapEditorCreate(props: EditorEvents["create"]) {
    latestTiptapHtml.current = props.editor.getHTML();
    editorRef.current = props.editor;
  }

  function onTiptapEditorUpdate(props: EditorEvents["update"]) {
    const html = props.editor.getHTML();

    const changedNodes = getChangedNodesFromHtml(
      latestTiptapHtml.current,
      html
    );

    updatePage(filename, {
      html,
      changedNodes,
    });

    latestTiptapHtml.current = html;
  }

  // TODO: add a loading state, possibly as a Suspense boundary
  return (
    <TiptapEditor
      autofocus={true}
      className={className}
      initialContent={initialHtml || ""}
      onCreate={onTiptapEditorCreate}
      onUpdate={onTiptapEditorUpdate}
    />
  );
}
