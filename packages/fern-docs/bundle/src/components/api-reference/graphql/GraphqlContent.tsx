import "server-only";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { type GraphqlContext, generateGraphQlSnippet } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { GraphqlContentCodeSnippets } from "@fern-docs/components/api-reference/graphql/GraphqlContentCodeSnippets";
import { GraphqlContextProvider } from "@fern-docs/components/api-reference/graphql/GraphqlContext";
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
import { getRemoteMDXRenderingConfig } from "@/server/remote-renderer/feature-flags";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { GraphqlContentLeft } from "./GraphqlContentLeft";

export async function GraphqlContent({
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
    context: GraphqlContext;
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
    const { node, operation, types } = context;
    const { enabled: useRemoteRendering } = getRemoteMDXRenderingConfig();

    // Pre-serialize all API type descriptions with batch-level caching
    const serializedTypes = useRemoteRendering ? await serializeApiDescriptionsWithBatchCache(types, node.slug) : types;

    // Use provided example or generate one from the operation schema
    const graphqlExample = operation.examples?.[0]
        ? {
              query: operation.examples[0].query,
              variables: operation.examples[0].variables,
              response: operation.examples[0].response
          }
        : (() => {
              const generated = generateGraphQlSnippet({ operation, types });
              return {
                  query: generated.query,
                  variables: Object.keys(generated.variables).length > 0 ? generated.variables : undefined,
                  response: generated.response
              };
          })();

    const { description: descriptionWithoutFooter, footerContent } = extractFooterContent(operation.description);

    return (
        <GraphqlContextProvider
            operation={operation}
            example={{ ...graphqlExample, variables: graphqlExample.variables ?? undefined }}
        >
            <ReferenceLayout
                theme={theme}
                header={
                    <PageHeader
                        serialize={serialize}
                        breadcrumb={breadcrumb}
                        title={node.title}
                        action={action}
                        tags={
                            operation.availability != null && (
                                <AvailabilityBadge availability={operation.availability} rounded />
                            )
                        }
                        slug={node.slug}
                        pageActionOptions={pageActionOptions}
                        markdownPromise={markdownPromise}
                        lang={lang}
                        pageActionsStyle={pageActionsStyle}
                    />
                }
                aside={<GraphqlContentCodeSnippets node={node} lang={lang} />}
                reference={
                    <TypeDefinitionRoot types={serializedTypes} slug={node.slug} isGraphQL>
                        <TypeDefinitionSlotsServer
                            types={serializedTypes}
                            lang={lang}
                            showUnionsAsDropdown={showUnionsAsDropdown}
                            isGraphQL
                        >
                            <GraphqlContentLeft context={context} lang={lang} />
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
        </GraphqlContextProvider>
    );
}
