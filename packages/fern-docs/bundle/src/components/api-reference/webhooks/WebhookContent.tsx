import "server-only";

import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { TypeDefinitionRoot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WebhookExamplesClient } from "@fern-docs/components/api-reference/webhooks/WebhookExamplesClient";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { extractFooterContent } from "@/mdx/components/footer/extract-footer-content";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { serializeApiDescriptionsWithBatchCache } from "@/server/remote-renderer/batch-cache-api-descriptions";
import { useRemoteMDXRendering } from "@/server/remote-renderer/feature-flags";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { WebhookContentLeft } from "./WebhookContentLeft";

function getAvailabilityBadge(webhook: ApiDefinition.WebhookDefinition, node: FernNavigation.WebhookNode) {
    const availability = webhook.availability ?? node.availability;
    return availability ? <AvailabilityBadge availability={availability} rounded /> : null;
}

export async function WebhookContent({
    serialize,
    context,
    breadcrumb,
    bottomNavigation,
    action,
    hideFeedback,
    pageActionOptions,
    markdownPromise,
    lang,
    pageActionsStyle = "default",
    theme,
    showUnionsAsDropdown = false
}: {
    serialize: MdxSerializer;
    context: ApiDefinition.WebhookContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation: React.ReactNode;
    action?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    lang: string;
    pageActionsStyle?: "default" | "toolbar";
    theme?: FernThemeConfig;
    showUnionsAsDropdown?: boolean;
}) {
    const { node, webhook, types } = context;
    const { enabled: useRemoteRendering } = useRemoteMDXRendering();

    // Pre-serialize all API type descriptions with batch-level caching
    const serializedTypes = useRemoteRendering ? await serializeApiDescriptionsWithBatchCache(types, node.slug) : types;

    // Extract footer content from the description
    const { description: descriptionWithoutFooter, footerContent } = extractFooterContent(webhook.description);

    const examples = webhook.examples ?? [];

    const webhookExamples =
        examples.length > 0 ? <WebhookExamplesClient examples={examples} slug={node.slug} lang={lang} /> : null;

    return (
        <ReferenceLayout
            theme={theme}
            header={
                <PageHeader
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    title={node.title}
                    action={action}
                    tags={getAvailabilityBadge(webhook, node)}
                    slug={node.slug}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                />
            }
            aside={webhookExamples}
            reference={
                <TypeDefinitionRoot types={serializedTypes} slug={node.slug}>
                    <TypeDefinitionSlotsServer
                        types={serializedTypes}
                        lang={lang}
                        showUnionsAsDropdown={showUnionsAsDropdown}
                    >
                        <WebhookContentLeft context={context} lang={lang} showUnionsAsDropdown={showUnionsAsDropdown} />
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
    );
}
