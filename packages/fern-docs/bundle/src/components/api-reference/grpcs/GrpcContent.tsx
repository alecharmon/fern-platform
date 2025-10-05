import "server-only";

import type React from "react";

import type { GrpcContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";

import { PageHeader } from "@/components/PageHeader";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { TypeDefinitionRoot } from "../type-definitions/TypeDefinitionContext";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { GrpcContentCodeSnippets } from "./GrpcContentCodeSnippets";
import { GrpcContentLeft } from "./GrpcContentLeft";
import { GrpcContextProvider } from "./GrpcContext";

export async function GrpcContent({
    serialize,
    context,
    breadcrumb,
    action,
    bottomNavigation,
    hideFeedback,
    pageActionOptions,
    markdown
}: {
    serialize: MdxSerializer;
    context: GrpcContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    action?: React.ReactNode;
    bottomNavigation?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdown?: string;
}) {
    const { node, grpc, types } = context;

    const grpcExample = {
        request: grpc.examples?.[0]?.requestBody?.value,
        response: grpc.examples?.[0]?.responseBody?.value
    };

    return (
        <GrpcContextProvider grpcEndpoint={grpc} example={grpcExample}>
            <ReferenceLayout
                header={
                    <PageHeader
                        serialize={serialize}
                        breadcrumb={breadcrumb}
                        title={node.title}
                        action={action}
                        tags={
                            grpc.availability != null && <AvailabilityBadge availability={grpc.availability} rounded />
                        }
                        slug={node.slug}
                        pageActionOptions={pageActionOptions}
                        markdown={markdown}
                    />
                }
                aside={<GrpcContentCodeSnippets node={node} />}
                reference={
                    <TypeDefinitionRoot types={types} slug={node.slug}>
                        <TypeDefinitionSlotsServer types={types}>
                            <GrpcContentLeft context={context} />
                        </TypeDefinitionSlotsServer>
                    </TypeDefinitionRoot>
                }
                footer={<FooterLayout bottomNavigation={bottomNavigation} hideFeedback={hideFeedback} />}
            >
                <MdxServerComponentProseSuspense mdx={grpc.description} />
            </ReferenceLayout>
        </GrpcContextProvider>
    );
}
