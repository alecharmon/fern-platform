import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect } from "react";

import FernEditorMDXRenderer from "@/components/editor/editor-mdx-renderer/FernEditorMDXRenderer";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import type { EncodedDocsUrl } from "@/utils/types";

import { UnsupportedContent } from "../UnsupportedContent";

export const CustomElementNodeView = (props: NodeViewProps) => {
    const { node, updateAttributes, editor, getPos } = props;
    const { attrs } = node;
    const params = useParams();

    // Get the MDX content from the node attributes
    const mdxb64 = attrs["fve-mdx-b64"];
    const newlyCreated = attrs["fve-newly-created"];
    const mdx = Buffer.from(mdxb64, "base64").toString("utf-8");

    // Extract docsUrl and branch from params
    const docsUrl = typeof params.docsUrl === "string" ? (params.docsUrl as EncodedDocsUrl) : undefined;
    const branch = typeof params.branch === "string" ? params.branch : undefined;

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
        updateAttributes({
            "fve-mdx-b64": Buffer.from(updatedMdx).toString("base64"),
            "fve-newly-created": false
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
                    docsUrl={docsUrl}
                    branch={branch}
                />
            </NodeViewWrapper>
        </ErrorBoundary>
    );
};
