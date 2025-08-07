"use client";

import React, { useEffect, useRef } from "react";

import { EditorEvents } from "@tiptap/react";

import { getChangedNodesFromHtml, mdxToHtml } from "@fern-docs/mdx";

import TiptapEditor from "@/components/editor/TiptapEditor";
import { useMdxState } from "@/providers/MdxStateContext";
import { useOriginalElements } from "@/providers/OriginalElementsContext";

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
  const { stageChanges, changedMdxFiles } = useMdxState();
  const { setOriginalElements } = useOriginalElements();

  // Store the first normalized HTML string from the editor
  const originalTiptapHtml = useRef(initialHtml);
  // Store whether this is the first update from the editor
  // (Kind of a hack to make sure the HTML is normalized by Tiptap before we make it available for comparison)
  const isFirstUpdate = useRef(true);
  const currentHtmlRef = useRef(initialHtml);

  // Track whether the last change came from internal TipTap editing or external source
  const lastChangeFromTiptap = useRef(false);

  function onTiptapEditorCreate(props: EditorEvents["create"]) {
    const latestTiptapHtml = props.editor.getHTML();
    originalTiptapHtml.current = latestTiptapHtml;
  }

  function onTiptapEditorUpdate(props: EditorEvents["update"]) {
    const latestTiptapHtml = props.editor.getHTML();

    if (originalTiptapHtml.current && isFirstUpdate.current === false) {
      // Mark that this change came from TipTap editing
      lastChangeFromTiptap.current = true;

      const changedNodes = getChangedNodesFromHtml(
        originalTiptapHtml.current,
        latestTiptapHtml
      );
      stageChanges(filename, { html: latestTiptapHtml, changedNodes });
    } else {
      isFirstUpdate.current = false;
    }
  }

  useEffect(() => {
    if (changedMdxFiles[filename]) {
      const currHtmlFromMdx = mdxToHtml(changedMdxFiles[filename], {
        treatAsCustomElement: ["code"],
        treatAsUnsupported: ["math"],
      });

      if (currHtmlFromMdx.html !== currentHtmlRef.current) {
        currentHtmlRef.current = currHtmlFromMdx.html;

        // Only update originalElements if this change did NOT come from TipTap editing
        // (i.e., it came from an external source like the dev panel)
        // This prevents the originalElements from being updated when the user is typing in the editor (yields flashing)
        if (!lastChangeFromTiptap.current) {
          setOriginalElements(currHtmlFromMdx.originalElements);
        }

        // Reset the flag for next change
        lastChangeFromTiptap.current = false;
      }
    }
  }, [changedMdxFiles, filename, setOriginalElements]);

  // TODO: add a loading state, possibly as a Suspense boundary
  return (
    <TiptapEditor
      autofocus={true}
      className={className}
      content={currentHtmlRef.current || ""}
      onCreate={onTiptapEditorCreate}
      onUpdate={onTiptapEditorUpdate}
    />
  );
}
