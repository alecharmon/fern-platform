"use client";

import type React from "react";
import { startTransition, useEffect, useState } from "react";
import { MdxAside } from "../bundler/component";
import { MdxContent } from "./MdxContent";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

interface RemoteMdxHydratorProps {
    /** Pre-rendered HTML from the remote renderer (shown on server for SEO) */
    html: string;
    /** The serialized MDX result (used for client-side interactive rendering) */
    mdx: { code: string; jsxElements: string[]; scope?: Record<string, unknown> };
    /** MDX engine type */
    engine?: "esbuild" | "next-remote" | "plaintext";
    /** Optional fallback for MdxContent */
    fallback?: React.ReactNode;
    /** When true, render MdxAside instead of MdxContent for aside sections */
    aside?: boolean;
}

/**
 * Client component that implements the "swap" hydration strategy for remotely
 * serialized MDX content.
 *
 * On the server (and initial client render):
 *   Renders pre-rendered HTML via dangerouslySetInnerHTML for SEO and first paint.
 *
 * After client mount:
 *   Swaps to a live React tree (MdxContent) for full interactivity.
 *
 * This is NOT React hydration (hydrateRoot). It's a clean DOM replacement.
 * React doesn't try to match the old DOM to the new tree — it removes one
 * and mounts the other. startTransition lets React prepare the new tree
 * offscreen before swapping, minimizing visual disruption.
 */
export function RemoteMdxHydrator({ html, mdx, engine, fallback, aside }: RemoteMdxHydratorProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (DEBUG) {
            console.log(
                `[RemoteMdxHydrator] 🔄 Client mounted, swapping static HTML (${html.length} chars) to live React tree`
            );
        }
        startTransition(() => setMounted(true));
    }, [html.length]);

    if (!mounted) {
        if (DEBUG) {
            console.log(
                `[RemoteMdxHydrator] 📄 Rendering static HTML (${html.length} chars, engine: ${engine ?? "unknown"})`
            );
        }
        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    }

    if (DEBUG) {
        console.log(`[RemoteMdxHydrator] ⚛️  Rendering live React tree (${mdx.jsxElements.length} custom components)`);
    }

    const clientMdx = { code: mdx.code, jsxElements: mdx.jsxElements, scope: mdx.scope };

    if (aside) {
        return <MdxAside code={clientMdx.code} jsxElements={clientMdx.jsxElements} engine={engine} />;
    }

    return <MdxContent mdx={clientMdx} fallback={fallback} engine={engine} />;
}
