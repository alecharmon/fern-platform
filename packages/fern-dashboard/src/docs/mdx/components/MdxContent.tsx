/**
 * Dashboard-specific MDX content renderer (client-side).
 *
 * This is the key differentiator from @fern-docs/bundle which uses server-side MDX rendering.
 * Shared API reference components accept MDX renderers via dependency injection, allowing
 * the dashboard to use this client-side MdxComponent while bundle uses server-rendered MDX.
 */
import type React from "react";

import { ErrorBoundary } from "@/docs/components/error-boundary";

import { MdxComponent } from "./component";

type MarkdownText = string | { code: string; jsxElements: string[] };

export declare namespace MdxContent {
    export interface Props {
        mdx: MarkdownText | MarkdownText[] | undefined;
        fallback?: React.ReactNode;
        /** @todo Handle for API compatibility with MdxServerComponentProseSuspense in @fern-docs/bundle */
        size?: string;
        /** @todo Handle for API compatibility with MdxServerComponentProseSuspense in @fern-docs/bundle */
        className?: string;
    }
}

function isMdxEmpty(mdx: MarkdownText | MarkdownText[] | undefined): boolean {
    if (!mdx) {
        return true;
    }

    if (typeof mdx === "string") {
        return mdx.trim().length === 0;
    }

    if (Array.isArray(mdx)) {
        return mdx.length === 0 || mdx.every(isMdxEmpty);
    }

    if (!mdx.code) {
        return true;
    }

    return mdx.code.trim().length === 0;
}

export function MdxContent({ mdx, fallback }: MdxContent.Props) {
    if (isMdxEmpty(mdx) || mdx == null) {
        return fallback;
    }

    if (typeof mdx === "string") {
        return mdx;
    }

    if (Array.isArray(mdx)) {
        return (
            <>
                {mdx.map((mdx, index) => (
                    <MdxContent key={index} mdx={mdx} />
                ))}
            </>
        );
    }

    return (
        <ErrorBoundary>
            <MdxComponent {...mdx} />
        </ErrorBoundary>
    );
}
