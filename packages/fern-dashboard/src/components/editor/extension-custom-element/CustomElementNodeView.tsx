import React from "react";

import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import FernEditorMDXRenderer from "@/components/editor/editor-mdx-renderer/FernEditorMDXRenderer";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { useFileResolver } from "@/providers/FileResolverContext";

import { UnsupportedContent } from "../UnsupportedContent";

export const CustomElementNodeView = (props: NodeViewProps) => {
  const { node, updateAttributes } = props;
  const { attrs } = node;

  // Get the MDX content from the node attributes
  const mdxb64 = attrs["fve-mdx-b64"];
  const mdx = Buffer.from(mdxb64, "base64").toString("utf-8");

  const { resolveFileSrc } = useFileResolver();

  const handleUpdate = (updatedMdx: string) => {
    // Match img tags and resolve their src attributes
    const imgRegex = /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/g;
    const processedMdx = updatedMdx.replace(
      imgRegex,
      (_match: string, beforeSrc: string, src: string, afterSrc: string) => {
        const resolvedFileData = resolveFileSrc(src);
        const resolvedSrc = resolvedFileData?.src || src;

        return `<img ${beforeSrc}src="${resolvedSrc}"${afterSrc}>`;
      }
    );

    updateAttributes({
      "fve-mdx-b64": Buffer.from(processedMdx).toString("base64"),
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
        <FernEditorMDXRenderer mdx={mdx} onUpdate={handleUpdate} />
      </NodeViewWrapper>
    </ErrorBoundary>
  );
};
