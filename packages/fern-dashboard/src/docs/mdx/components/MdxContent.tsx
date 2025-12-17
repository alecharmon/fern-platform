/**
 * Dashboard-specific MDX content renderer (client-side).
 *
 * This is the key differentiator from @fern-docs/bundle which uses server-side MDX rendering.
 * Shared API reference components accept MDX renderers via dependency injection, allowing
 * the dashboard to use this client-side MdxComponent while bundle uses server-rendered MDX.
 */

import { Prose } from "@fern-docs/components/mdx/prose";
import { getMDXComponent } from "mdx-bundler/client";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { cachedBundleMDX } from "@/components/editor/editor-mdx-renderer/cache";
import { ErrorBoundary } from "@/docs/components/error-boundary";

import { MDX_COMPONENTS } from "./";
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

/**
 * Renderer for raw MDX strings that bundles them client-side.
 * Uses the same caching infrastructure as the TipTap editor.
 * Mirrors the editor implementation by using getMDXComponent and passing components directly.
 */
function MdxStringRenderer({ mdx }: { mdx: string }) {
    const [state, setState] = useState<{ type: "BUNDLING" } | { type: "BUNDLED"; code: string } | { type: "ERROR" }>({
        type: "BUNDLING"
    });

    useEffect(() => {
        let cancelled = false;

        // Quick check: if no MDX-like syntax, render as plain text
        if (!/[<>[\]`*_#]/.test(mdx)) {
            setState({ type: "ERROR" }); // Treat as plain text
            return;
        }

        void (async () => {
            try {
                const result = await cachedBundleMDX(mdx);
                if (!cancelled) {
                    setState({ type: "BUNDLED", code: result.code });
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn("[MdxStringRenderer] Failed to bundle MDX:", error);
                    setState({ type: "ERROR" });
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [mdx]);

    // Memoize the MDX component creation (mirrors editor's TerminalMDXRenderer)
    const MDXComponent = useMemo(() => {
        if (state.type !== "BUNDLED") {
            return null;
        }
        try {
            return getMDXComponent(state.code);
        } catch (error) {
            console.warn("[MdxStringRenderer] Failed to create MDX component:", error);
            return null;
        }
    }, [state]);

    if (state.type === "BUNDLING") {
        return <div className="animate-pulse rounded bg-muted/30" style={{ height: "1em", width: "75%" }} />;
    }

    if (state.type === "ERROR" || MDXComponent == null) {
        // Fallback to raw text on error or plain text
        return <>{mdx}</>;
    }

    // Render bundled MDX, passing components directly (like editor does)
    return (
        <ErrorBoundary>
            <MDXComponent components={MDX_COMPONENTS} />
        </ErrorBoundary>
    );
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
                <MdxStringRenderer mdx={mdx} />
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
        return <MdxStringRenderer mdx={mdx} />;
    }

    return (
        <ErrorBoundary>
            <MdxComponent {...mdx} />
        </ErrorBoundary>
    );
}
