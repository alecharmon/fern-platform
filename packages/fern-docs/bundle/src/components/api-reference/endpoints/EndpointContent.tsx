import "server-only";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { EndpointContextProvider } from "@fern-docs/components/api-reference/endpoints/EndpointContext";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import type React from "react";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { PlaygroundKeyboardTrigger } from "@/components/playground/PlaygroundKeyboardTrigger";
import { extractFooterContent } from "@/mdx/components/footer/extract-footer-content";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { ApiReferenceClientWrapper } from "../ApiReferenceClientWrapper";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { EndpointContentCodeSnippets } from "./EndpointContentCodeSnippets";
import { EndpointContentLeft } from "./EndpointContentLeft";
import { EndpointUrlWithPlaygroundBaseUrl } from "./EndpointUrlWithPlaygroundBaseUrl";

function getAvailabilityBadge(endpoint: EndpointContext["endpoint"], node: EndpointContext["node"]) {
    const availability = endpoint.availability ?? node.availability;
    return availability ? <AvailabilityBadge availability={availability} rounded /> : null;
}

export async function EndpointContent({
    serialize,
    showErrors,
    showAuth,
    context,
    breadcrumb,
    action,
    bottomNavigation,
    hideFeedback,
    pageActionOptions,
    markdownPromise,
    lang,
    pageActionsStyle = "default",
    theme
}: {
    serialize: MdxSerializer;
    showErrors: boolean;
    showAuth: boolean;
    context: EndpointContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    action?: React.ReactNode;
    bottomNavigation?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    lang: string;
    pageActionsStyle?: "default" | "toolbar";
    theme?: FernThemeConfig;
}) {
    const { node, endpoint, types } = context;

    // Extract footer content from the description
    const { description: descriptionWithoutFooter, footerContent } = extractFooterContent(endpoint.description);

    return (
        <EndpointContextProvider endpoint={endpoint}>
            <ReferenceLayout
                theme={theme}
                header={
                    <PageHeader
                        serialize={serialize}
                        breadcrumb={breadcrumb}
                        title={node.title}
                        action={action}
                        tags={getAvailabilityBadge(endpoint, node)}
                        slug={node.slug}
                        pageActionOptions={pageActionOptions}
                        markdownPromise={markdownPromise}
                        lang={lang}
                        pageActionsStyle={pageActionsStyle}
                    >
                        <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                            <EndpointUrlWithPlaygroundBaseUrl
                                endpoint={endpoint}
                                className={endpoint.protocol?.type === "grpc" ? "hidden" : "hidden lg:flex"}
                                lang={lang}
                            />
                        </ApiReferenceClientWrapper>
                    </PageHeader>
                }
                aside={
                    <ApiReferenceClientWrapper apiDefinitionId={node.apiDefinitionId}>
                        <EndpointContentCodeSnippets
                            endpoint={endpoint}
                            showErrors={showErrors}
                            node={node}
                            lang={lang}
                        />
                    </ApiReferenceClientWrapper>
                }
                reference={
                    <TypeDefinitionRoot types={types} slug={node.slug}>
                        <TypeDefinitionSlotsServer types={types} lang={lang}>
                            <EndpointContentLeft
                                context={context}
                                showAuth={showAuth}
                                showErrors={showErrors}
                                lang={lang}
                            />
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
                <PlaygroundKeyboardTrigger key="keyboard-trigger" />
                <MdxServerComponentProseSuspense key="description" mdx={descriptionWithoutFooter} />
            </ReferenceLayout>
        </EndpointContextProvider>
    );
}
