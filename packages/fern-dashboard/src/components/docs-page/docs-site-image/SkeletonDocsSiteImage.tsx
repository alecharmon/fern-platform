"use client";

import type { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { Skeleton } from "@/components/ui/skeleton";

import { DocsSiteImageLayout } from "./DocsSiteImageLayout";

export declare namespace SkeletonDocsSiteImage {
    export interface Props {
        docsUrl?: FdrAPI.dashboard.DocsSiteUrl;
    }
}

export function SkeletonDocsSiteImage({ docsUrl }: SkeletonDocsSiteImage.Props) {
    return (
        <DocsSiteImageLayout docsUrl={docsUrl}>
            <Skeleton className="flex-1" />
        </DocsSiteImageLayout>
    );
}
