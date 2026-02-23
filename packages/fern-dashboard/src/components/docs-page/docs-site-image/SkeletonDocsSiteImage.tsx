"use client";

import type { DocsSiteUrl } from "@fern-api/fdr-sdk/orpc-client";

import { Skeleton } from "@/components/ui/skeleton";

import { DocsSiteImageLayout } from "./DocsSiteImageLayout";

export declare namespace SkeletonDocsSiteImage {
    export interface Props {
        docsUrl?: DocsSiteUrl;
    }
}

export function SkeletonDocsSiteImage({ docsUrl }: SkeletonDocsSiteImage.Props) {
    return (
        <DocsSiteImageLayout docsUrl={docsUrl}>
            <Skeleton className="flex-1" />
        </DocsSiteImageLayout>
    );
}
