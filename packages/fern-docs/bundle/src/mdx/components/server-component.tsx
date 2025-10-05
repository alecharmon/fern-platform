import React from "react";

import { Prose } from "@fern-docs/components/mdx/prose";

import { ErrorBoundary } from "@/components/error-boundary";
import { getMdxSerializer } from "@/context/MdxSerializerContext";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { MdxContent } from "./MdxContent";

export async function MdxServerComponent({
    serialize,
    mdx,
    filename,
    slug
}: {
    serialize: MdxSerializer;
    mdx: string | null | undefined;
    filename?: string;
    slug?: string;
}) {
    if (!mdx) {
        return null;
    }

    const parsed_mdx = await serialize(mdx, {
        filename,
        slug
    });

    return <MdxContent mdx={parsed_mdx} fallback={mdx} useNextMdx={parsed_mdx?.engine === "next-remote"} />;
}

export function MdxServerComponentProse({
    mdx,
    size,
    className,
    filename,
    slug,
    fallback
}: {
    mdx: string | null | undefined;
    size?: "xs" | "sm" | "base" | "lg";
    className?: string;
    filename?: string;
    slug?: string;
    fallback?: React.ReactNode;
}) {
    const serialize = getMdxSerializer();

    // Handle the case where the mdx is not found, or serializer is not available yet
    if (!mdx || !serialize) {
        return (
            <Prose size={size} className={className}>
                {mdx ?? fallback}
            </Prose>
        );
    }

    return (
        <Prose size={size} className={className}>
            <MdxServerComponent mdx={mdx} serialize={serialize} filename={filename} slug={slug} />
        </Prose>
    );
}

export function MdxServerComponentProseSuspense({
    mdx,
    size,
    className,
    fallback,
    filename,
    slug
}: {
    mdx: string | null | undefined;
    size?: "xs" | "sm" | "base" | "lg";
    className?: string;
    filename?: string;
    slug?: string;
    fallback?: React.ReactNode;
}) {
    return (
        <ErrorBoundary
            fallback={
                <Prose size={size} pre={mdx != null} className={className}>
                    {mdx ?? fallback}
                </Prose>
            }
        >
            <React.Suspense
                fallback={
                    <Prose size={size} className={className}>
                        {mdx ?? fallback}
                    </Prose>
                }
            >
                <MdxServerComponentProse
                    mdx={mdx}
                    size={size}
                    className={className}
                    fallback={fallback}
                    filename={filename}
                    slug={slug}
                />
            </React.Suspense>
        </ErrorBoundary>
    );
}
