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
  const skipNormalUpdateBecauseUpdateIsFromDevPanel = useRef(false);
  const latestTiptapHtml = useRef<string>(initialHtml || "");

  const { updatePage, subscribeSaveEvent } = usePages();

  // Subscribe to save events
  useEffect(() => {
    const unsubscribe = subscribeSaveEvent((event) => {
      skipNormalUpdateBecauseUpdateIsFromDevPanel.current = true;
      editorRef.current?.commands.setContent(event.html);
    });

    return unsubscribe;
  }, [filename, subscribeSaveEvent, latestTiptapHtml, editorRef]);

  function onTiptapEditorCreate(props: EditorEvents["create"]) {
    latestTiptapHtml.current = props.editor.getHTML();
    editorRef.current = props.editor;
  }

  function onTiptapEditorUpdate(props: EditorEvents["update"]) {
    const html = props.editor.getHTML();

    if (!skipNormalUpdateBecauseUpdateIsFromDevPanel.current) {
      const changedNodes = getChangedNodesFromHtml(
        latestTiptapHtml.current,
        html
      );

      updatePage(filename, {
        html,
        changedNodes,
      });
    } else {
      skipNormalUpdateBecauseUpdateIsFromDevPanel.current = false;
    }

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
