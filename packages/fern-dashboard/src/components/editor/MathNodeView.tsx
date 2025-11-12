"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import { useEffect, useRef } from "react";
import { MathNodeWrapper } from "./NodeHoverWrapper";

interface MathNodeViewProps extends NodeViewProps {
    displayMode?: boolean;
}

export const MathNodeView = ({ node, displayMode = false }: MathNodeViewProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const latex = node.attrs.latex || "";

    useEffect(() => {
        if (containerRef.current) {
            try {
                katex.render(latex, containerRef.current, {
                    displayMode,
                    throwOnError: false
                });
            } catch (error) {
                console.error("Error rendering math:", error);
                if (containerRef.current) {
                    containerRef.current.textContent = latex;
                }
            }
        }
    }, [latex, displayMode]);

    return (
        <NodeViewWrapper
            as={displayMode ? "div" : "span"}
            className={displayMode ? "block-math-wrapper" : "inline-math-wrapper"}
            data-type={displayMode ? "block-math" : "inline-math"}
            data-latex={latex}
        >
            <MathNodeWrapper inline={!displayMode}>
                <div ref={containerRef} className={displayMode ? "block-math-inner" : "inline-math-inner"} />
            </MathNodeWrapper>
        </NodeViewWrapper>
    );
};

export const BlockMathNodeView = (props: NodeViewProps) => {
    return <MathNodeView {...props} displayMode={true} />;
};

export const InlineMathNodeView = (props: NodeViewProps) => {
    return <MathNodeView {...props} displayMode={false} />;
};
