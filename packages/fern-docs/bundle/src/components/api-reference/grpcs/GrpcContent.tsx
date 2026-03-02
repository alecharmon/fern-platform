import "server-only";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { GrpcContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { GrpcContentCodeSnippets } from "@fern-docs/components/api-reference/grpcs/GrpcContentCodeSnippets";
import { GrpcContextProvider } from "@fern-docs/components/api-reference/grpcs/GrpcContext";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import type React from "react";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { extractFooterContent } from "@/mdx/components/footer/extract-footer-content";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { serializeApiDescriptionsWithBatchCache } from "@/server/remote-renderer/batch-cache-api-descriptions";
import { useRemoteMDXRendering } from "@/server/remote-renderer/feature-flags";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { GrpcContentLeft } from "./GrpcContentLeft";

export async function GrpcContent({
    serialize,
    context,
    breadcrumb,
    action,
    bottomNavigation,
    hideFeedback,
    pageActionOptions,
    markdownPromise,
    lang,
    pageActionsStyle = "default",
    theme,
    showUnionsAsDropdown = false
}: {
    serialize: MdxSerializer;
    context: GrpcContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    action?: React.ReactNode;
    bottomNavigation?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    lang: string;
    pageActionsStyle?: "default" | "toolbar";
    theme?: FernThemeConfig;
    showUnionsAsDropdown?: boolean;
}) {
    const { node, grpc, types } = context;
    const { enabled: useRemoteRendering } = useRemoteMDXRendering();

    // Pre-serialize all API type descriptions with batch-level caching
    const serializedTypes = useRemoteRendering ? await serializeApiDescriptionsWithBatchCache(types, node.slug) : types;

    // Extract footer content from the description
    const { description: descriptionWithoutFooter, footerContent } = extractFooterContent(grpc.description);

    const grpcExample = {
        request: grpc.examples?.[0]?.requestBody?.value,
        response: grpc.examples?.[0]?.responseBody?.value
    };

    return (
        <GrpcContextProvider grpcEndpoint={grpc} example={grpcExample}>
            <ReferenceLayout
                theme={theme}
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
                        markdownPromise={markdownPromise}
                        lang={lang}
                        pageActionsStyle={pageActionsStyle}
                    />
                }
                aside={<GrpcContentCodeSnippets node={node} lang={lang} />}
                reference={
                    <TypeDefinitionRoot types={serializedTypes} slug={node.slug}>
                        <TypeDefinitionSlotsServer
                            types={serializedTypes}
                            lang={lang}
                            showUnionsAsDropdown={showUnionsAsDropdown}
                        >
                            <GrpcContentLeft context={context} lang={lang} />
                        </TypeDefinitionSlotsServer>
                    </TypeDefinitionRoot>
                }
                descriptionFooter={
                    footerContent ? (
                        <MdxServerComponentProseSuspense key="description-footer" mdx={footerContent} />
                    ) : undefined
                }
                footer={<FooterLayout bottomNavigation={bottomNavigation} hideFeedback={hideFeedback} lang={lang} />}
            >
                <MdxServerComponentProseSuspense mdx={descriptionWithoutFooter} />
            </ReferenceLayout>
        </GrpcContextProvider>
    );
}
