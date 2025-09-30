import React, { useCallback, useEffect } from "react";

import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import FernEditorMDXRenderer from "@/components/editor/editor-mdx-renderer/FernEditorMDXRenderer";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { useFileResolver } from "@/providers/FileResolverContext";

import { UnsupportedContent } from "../UnsupportedContent";

export const CustomElementNodeView = (props: NodeViewProps) => {
  const { node, updateAttributes, editor, getPos } = props;
  const { attrs } = node;

  // Get the MDX content from the node attributes
  const mdxb64 = attrs["fve-mdx-b64"];
  const newlyCreated = attrs["fve-newly-created"];
  const mdx = Buffer.from(mdxb64, "base64").toString("utf-8");

  const { resolveFileSrc } = useFileResolver();

  // Delete the node when mdxb64 becomes empty
  const handleDelete = useCallback(() => {
    const pos = getPos();
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .run();
    }
  }, [getPos, editor, node.nodeSize]);

  // Monitor mdxb64 and delete node if it becomes empty
  // This happens when a user deletes the element via a popover.
  // It's sort of hacky, but the delete function just sets the mdx content to "".
  useEffect(() => {
    if (!mdxb64 || mdxb64.trim() === "") {
      handleDelete();
    }
  }, [mdxb64, handleDelete]);

  const handleUpdate = (updatedMdx: string) => {
    // Match img and embed tags and resolve their src attributes
    const tagRegex =
      /<(img|embed|video)\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/g;
    const processedMdx = updatedMdx.replace(
      tagRegex,
      (
        _match: string,
        tag: string,
        beforeSrc: string,
        src: string,
        afterSrc: string
      ) => {
        const resolvedFileData = resolveFileSrc(src);
        const resolvedSrc = resolvedFileData?.src || src;

        return `<${tag} ${beforeSrc}src="${resolvedSrc}"${afterSrc}>`;
      }
    );

    updateAttributes({
      "fve-mdx-b64": Buffer.from(processedMdx).toString("base64"),
      "fve-newly-created": false,
    });
  };

  return (
    <ErrorBoundary
      fallback={
        <NodeViewWrapper>
          <UnsupportedContent>{mdx}</UnsupportedContent>
        </NodeViewWrapper>
      }
    >
      <NodeViewWrapper>
        <FernEditorMDXRenderer
          mdx={mdx}
          onUpdate={handleUpdate}
          newlyCreated={newlyCreated}
        />
      </NodeViewWrapper>
    </ErrorBoundary>
  );
};
