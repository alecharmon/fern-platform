"use client";

import { useMDXComponents } from "@mdx-js/react";
import { getMDXComponent } from "mdx-bundler/client";
import React, { useEffect, useMemo, useState } from "react";

import { ErrorBoundary } from "@/docs/components/error-boundary";
import type { EncodedDocsUrl } from "@/utils/types";

import { cachedBundleMDX } from "./editor-mdx-renderer/cache";

interface ReadOnlyMdxContentProps {
    markdown: string;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

export const ReadOnlyMdxContent = React.memo(function ReadOnlyMdxContent({
    markdown,
    docsUrl,
    branch
}: ReadOnlyMdxContentProps) {
    const [code, setCode] = useState<string | null>(null);
    const components = useMDXComponents();

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const result = await cachedBundleMDX(markdown, { docsUrl, branch });
                if (!cancelled) {
                    setCode(result.code);
                }
            } catch (error) {
                console.warn("[ReadOnlyMdxContent] Failed to bundle MDX:", error);
                if (!cancelled) {
                    setCode(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [markdown, docsUrl, branch]);

    const MDXComponent = useMemo(() => {
        if (!code) {
            return null;
        }
        try {
            return getMDXComponent(code);
        } catch {
            return null;
        }
    }, [code]);

    if (!MDXComponent) {
        return null;
    }

    return (
        <ErrorBoundary>
            <MDXComponent components={components} />
        </ErrorBoundary>
    );
});
