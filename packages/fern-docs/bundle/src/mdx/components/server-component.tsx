import { logger } from "@fern-api/ui-core-utils/logger";
import { Prose } from "@fern-docs/components/mdx/prose";
import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { getDocsLoaderContext } from "@/context/DocsLoaderContext";
import { getMdxSerializer } from "@/context/MdxSerializerContext";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { extractMergeWidgetContent } from "./footer/extract-merge-widget-content";
import { MdxContent } from "./MdxContent";
import { MergeSupportedFieldsByIntegrationServer } from "./MergeSupportedFieldsByIntegrationServer";

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

    let parsed_mdx: Awaited<ReturnType<MdxSerializer>> | undefined;
    try {
        parsed_mdx = await serialize(mdx, {
            filename,
            slug
        });
    } catch (error) {
        logger.error(
            `[MdxServerComponent] serialize failed for filename: ${filename || "unknown"}, slug: ${slug || "unknown"}`,
            error
        );
    }

    return <MdxContent mdx={parsed_mdx} fallback={mdx} engine={parsed_mdx?.engine} />;
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
    // Extract the widget from the MDX to render it outside the Suspense boundary,
    // preventing the raw base64 data blob from flashing as fallback text.
    const { description: cleanMdx, widgetProps } = extractMergeWidgetContent(mdx);
    const loaderContext = widgetProps ? getDocsLoaderContext() : undefined;

    return (
        <>
            <ErrorBoundary
                fallback={
                    <Prose size={size} pre={cleanMdx != null} className={className}>
                        {cleanMdx ?? fallback}
                    </Prose>
                }
            >
                <React.Suspense
                    fallback={
                        <Prose size={size} className={className}>
                            {cleanMdx ?? fallback}
                        </Prose>
                    }
                >
                    <MdxServerComponentProse
                        mdx={cleanMdx}
                        size={size}
                        className={className}
                        fallback={fallback}
                        filename={filename}
                        slug={slug}
                    />
                </React.Suspense>
            </ErrorBoundary>
            {widgetProps && loaderContext && (
                <MergeSupportedFieldsByIntegrationServer
                    loader={loaderContext.loader}
                    data={widgetProps.data}
                    requestType={widgetProps.requestType}
                    lang={loaderContext.lang}
                />
            )}
        </>
    );
}
