"use client";

/**
 * Dashboard-specific GrpcContent (client-side, read-only).
 *
 * Main component for rendering gRPC API reference pages.
 * Uses ReferenceLayout with header, code snippets, and request/response sections.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/grpcs/GrpcContent.tsx
 */

import type { GrpcContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { GrpcContentCodeSnippets } from "@fern-docs/components/api-reference/grpcs/GrpcContentCodeSnippets";
import { GrpcContextProvider } from "@fern-docs/components/api-reference/grpcs/GrpcContext";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { FernBreadcrumbs } from "@fern-docs/components/FernBreadcrumbs";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";

import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { GrpcContentLeft } from "./GrpcContentLeft";

export interface GrpcContentProps {
    context: GrpcContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function GrpcContent({ context, breadcrumb, lang }: GrpcContentProps) {
    const { node, grpc, types } = context;

    const grpcExample = {
        request: grpc.examples?.[0]?.requestBody?.value,
        response: grpc.examples?.[0]?.responseBody?.value
    };

    return (
        <GrpcContextProvider grpcEndpoint={grpc} example={grpcExample}>
            <ReferenceLayout
                header={<GrpcPageHeader breadcrumb={breadcrumb} title={node.title} availability={grpc.availability} />}
                aside={<GrpcContentCodeSnippets node={node} lang={lang} />}
                reference={
                    <TypeDefinitionRoot types={types} slug={node.slug}>
                        <TypeDefinitionSlotsServer types={types} lang={lang}>
                            <GrpcContentLeft context={context} lang={lang} />
                        </TypeDefinitionSlotsServer>
                    </TypeDefinitionRoot>
                }
            >
                <MdxContent mdx={grpc.description} />
            </ReferenceLayout>
        </GrpcContextProvider>
    );
}

/**
 * Simplified page header for dashboard (no page actions)
 */
function GrpcPageHeader({
    breadcrumb,
    title,
    availability
}: {
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    title: string;
    availability: GrpcContext["grpc"]["availability"];
}) {
    return (
        <header className="my-8 space-y-2">
            {breadcrumb.length > 0 && (
                <div className="flex justify-between">
                    <FernBreadcrumbs breadcrumb={breadcrumb} />
                </div>
            )}

            <div className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-row items-center gap-4">
                    <h1 className="fern-page-heading text-balance break-words">{title}</h1>
                    {availability && <AvailabilityBadge availability={availability} rounded />}
                </div>
            </div>
        </header>
    );
}
