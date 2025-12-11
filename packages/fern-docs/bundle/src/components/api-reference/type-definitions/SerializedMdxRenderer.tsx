"use client";

import { Prose } from "@fern-docs/components/mdx/prose";
import React from "react";

import { ErrorBoundary } from "@/components/error-boundary";
import { MdxContent } from "@/mdx/components/MdxContent";
import type { SerializedDescription } from "@/mdx/plugins/serialize-type-definition-descriptions";

export interface SerializedMdxRendererProps {
    serializedDescription: SerializedDescription;
    fallback?: string;
    size?: "xs" | "sm" | "base" | "lg";
    className?: string;
}

/**
 * Client component that renders pre-serialized MDX content.
 * Use this when the MDX has already been serialized (e.g., from rehype-schema plugin).
 */
export const SerializedMdxRenderer = React.memo(function SerializedMdxRenderer({
    serializedDescription,
    fallback,
    size = "sm",
    className
}: SerializedMdxRendererProps) {
    return (
        <ErrorBoundary
            fallback={
                <Prose size={size} pre={fallback != null} className={className}>
                    {fallback}
                </Prose>
            }
        >
            <Prose size={size} className={className}>
                <MdxContent mdx={serializedDescription} fallback={fallback} engine={serializedDescription.engine} />
            </Prose>
        </ErrorBoundary>
    );
});
