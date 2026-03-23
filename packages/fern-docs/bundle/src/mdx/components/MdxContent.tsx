import { logger } from "@fern-api/ui-core-utils/logger";
import dynamic from "next/dynamic";
import type React from "react";
import { ErrorBoundary, ErrorBoundaryFallback } from "@/components/error-boundary";
import { RemoteMdxHydrator } from "./RemoteMdxHydrator";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

type MarkdownText =
    | string
    | {
          code: string;
          jsxElements: string[];
          scope?: Record<string, unknown>;
          /** Pre-rendered HTML from remote batch serializer (for SEO) */
          _contentHtml?: string;
          /** Present when rendering failed; signals the client to show an error UI */
          _error?: { message: string };
      };

export declare namespace MdxContent {
    export interface Props {
        mdx: MarkdownText | MarkdownText[] | undefined;
        fallback?: React.ReactNode;
        engine?: "esbuild" | "next-remote" | "plaintext";
    }
}

const MdxBundlerComponent = dynamic(() => import("../bundler/component").then((mod) => mod.MdxComponent), {
    ssr: true
});

const NextMdxRemoteComponent = dynamic(() => import("../bundler/component").then((mod) => mod.NextMdxRemoteComponent), {
    ssr: true
});

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

export function MdxContent({ mdx, fallback, engine }: MdxContent.Props): React.ReactNode {
    if (isMdxEmpty(mdx) || mdx == null) {
        return fallback;
    }

    if (typeof mdx === "string") {
        return <>{mdx}</>;
    }

    if (Array.isArray(mdx)) {
        return (
            <>
                {mdx.map((mdx, index) => (
                    <MdxContent key={index} mdx={mdx} engine={engine} />
                ))}
            </>
        );
    }

    // Remote renderer returned an error — show error UI instead of raw markdown
    if (mdx._error) {
        return <ErrorBoundaryFallback error={new Error(mdx._error.message)} lang="en" />;
    }

    if (engine === "plaintext") {
        return <>{typeof mdx === "string" ? mdx : mdx.code}</>;
    }

    // Remote rendering mode: if the serializer returned pre-rendered HTML,
    // use RemoteMdxHydrator to show static HTML for SEO, then swap to
    // a live React tree on the client for full interactivity.
    if (mdx._contentHtml) {
        if (DEBUG) {
            logger.debug(
                `[MdxContent] Remote rendering mode: using RemoteMdxHydrator (HTML: ${mdx._contentHtml.length} chars, ${mdx.jsxElements.length} components, engine: ${engine ?? "unknown"})`
            );
        }
        return (
            <ErrorBoundary>
                <RemoteMdxHydrator
                    html={mdx._contentHtml}
                    mdx={{ code: mdx.code, jsxElements: mdx.jsxElements, scope: mdx.scope }}
                    engine={engine}
                    fallback={fallback}
                />
            </ErrorBoundary>
        );
    }

    const MdxComponent = engine === "next-remote" ? NextMdxRemoteComponent : MdxBundlerComponent;

    if (DEBUG) {
        logger.debug(
            `[MdxContent] Local rendering mode: using ${engine === "next-remote" ? "NextMdxRemote" : "MdxBundler"} (${mdx.jsxElements.length} components)`
        );
    }
    return (
        <ErrorBoundary>
            <MdxComponent {...mdx} scope={mdx.scope ?? {}} />
        </ErrorBoundary>
    );
}
