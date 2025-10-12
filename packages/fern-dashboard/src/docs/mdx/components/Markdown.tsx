"use client";

import { Prose } from "@fern-docs/components/mdx/prose";
import { memo, type ReactNode } from "react";

import { MdxContent } from "./MdxContent";

export declare namespace Markdown {
    export interface Props {
        title?: ReactNode;

        // mdx: string | FernDocs.ResolvedMdx | string | FernDocs.ResolvedMdx[] | undefined;
        mdx:
            | string
            | { code: string; jsxElements: string[] }
            | (string | { code: string; jsxElements: string[] })[]
            | undefined;
        className?: string;
        size?: "xs" | "sm" | "lg";

        /**
         * Fallback content to render if the MDX is empty
         */
        fallback?: ReactNode;
    }
}

export const Markdown = memo<Markdown.Props>(({ title, mdx, className, size, fallback }) => {
    // If the MDX is empty, return null
    if (!fallback && (mdx == null || (typeof mdx === "string" && mdx.trimStart().length === 0))) {
        return null;
    }

    return (
        <Prose className={className} size={size} pre={typeof mdx === "string"}>
            {title}
            <MdxContent mdx={mdx} fallback={fallback} />
        </Prose>
    );
});

Markdown.displayName = "Markdown";
