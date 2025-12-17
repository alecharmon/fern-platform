"use client";

/**
 * Dashboard-specific ApiGrpcPage (client-side, read-only).
 *
 * Entry point component for rendering gRPC API reference pages.
 * Creates gRPC context and renders GrpcContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/grpcs/GrpcContent.tsx
 */

import { type ApiDefinition, createGrpcContext, prune } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { GrpcContent } from "./grpcs/GrpcContent";

export interface ApiGrpcPageProps {
    node: FernNavigation.GrpcNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function ApiGrpcPage({ node, apiDefinition, breadcrumb, lang }: ApiGrpcPageProps) {
    const context = createGrpcContext(node, prune(apiDefinition, node));

    if (!context) {
        return (
            <div className="flex items-center justify-center p-8 text-center">
                <p className="text-(color:--grayscale-a11)">Could not load gRPC method: {node.title}</p>
            </div>
        );
    }

    return <GrpcContent context={context} breadcrumb={breadcrumb} lang={lang} />;
}
