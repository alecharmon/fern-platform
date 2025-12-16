/**
 * Dashboard-specific MDX content renderer (client-side).
 *
 * This is the key differentiator from @fern-docs/bundle which uses server-side MDX rendering.
 * Shared API reference components accept MDX renderers via dependency injection, allowing
 * the dashboard to use this client-side MdxComponent while bundle uses server-rendered MDX.
 */

import { Prose } from "@fern-docs/components/mdx/prose";
import type React from "react";

import { ErrorBoundary } from "@/docs/components/error-boundary";

import { MdxComponent } from "./component";

type MarkdownText = string | { code: string; jsxElements: string[] };

export declare namespace MdxContent {
    export interface Props {
        mdx: MarkdownText | MarkdownText[] | undefined;
        fallback?: React.ReactNode;
        size?: "xs" | "sm" | "base" | "lg";
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

export function MdxContent({ mdx, fallback, size, className }: MdxContent.Props) {
    if (isMdxEmpty(mdx) || mdx == null) {
        return fallback ? (
            <Prose size={size} className={className}>
                {fallback}
            </Prose>
        ) : null;
    }

    if (typeof mdx === "string") {
        return (
            <Prose size={size} className={className}>
                {mdx}
            </Prose>
        );
    }

    if (Array.isArray(mdx)) {
        return (
            <Prose size={size} className={className}>
                {mdx.map((item, index) => (
                    <MdxContentInner key={index} mdx={item} />
                ))}
            </Prose>
        );
    }

    return (
        <Prose size={size} className={className}>
            <ErrorBoundary>
                <MdxComponent {...mdx} />
            </ErrorBoundary>
        </Prose>
    );
}

/**
 * Inner component for rendering MDX content without wrapping in Prose.
 * Used for array items to avoid nested Prose elements.
 */
function MdxContentInner({ mdx }: { mdx: MarkdownText }) {
    if (typeof mdx === "string") {
        return <>{mdx}</>;
    }

    return (
        <ErrorBoundary>
            <MdxComponent {...mdx} />
        </ErrorBoundary>
    );
}
