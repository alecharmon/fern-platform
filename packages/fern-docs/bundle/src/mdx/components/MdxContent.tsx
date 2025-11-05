import dynamic from "next/dynamic";
import type React from "react";

import { ErrorBoundary } from "@/components/error-boundary";

type MarkdownText = string | { code: string; jsxElements: string[]; scope?: Record<string, unknown> };

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

    if (engine === "plaintext") {
        return <>{typeof mdx === "string" ? mdx : mdx.code}</>;
    }

    const MdxComponent = engine === "next-remote" ? NextMdxRemoteComponent : MdxBundlerComponent;

    return (
        <ErrorBoundary>
            <MdxComponent {...mdx} scope={mdx.scope ?? {}} />
        </ErrorBoundary>
    );
}
