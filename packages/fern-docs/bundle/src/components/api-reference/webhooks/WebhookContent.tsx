import "server-only";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { getMessageForStatus } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { StatusCodeBadge } from "@fern-docs/components/badges";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { Prose } from "@fern-docs/components/mdx/prose";
import { t } from "@fern-docs/i18n";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { renderTypeShorthand } from "@/components/type-shorthand";
import { extractFooterContent } from "@/mdx/components/footer/extract-footer-content";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";
import { EndpointSection } from "../endpoints/EndpointSection";
import { ObjectProperty } from "../type-definitions/ObjectProperty";
import { TypeDefinitionAnchorPart, TypeDefinitionRoot } from "../type-definitions/TypeDefinitionContext";
import { WithSeparator } from "../type-definitions/TypeDefinitionDetails";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";
import { WebhookExample } from "./WebhookExample";
import { WebhookResponseSection } from "./WebhookResponseSection";

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
    pageActionsStyle = "default"
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
}) {
    const { node, webhook, types } = context;

    // Extract footer content from the description
    const { description: descriptionWithoutFooter, footerContent } = extractFooterContent(webhook.description);

    const example = webhook.examples?.[0]; // TODO: Need a way to show all the examples
    const responses = webhook.responses;

    const webhookExample = example ? <WebhookExample example={example} slug={node.slug} lang={lang} /> : null;

    return (
        <ReferenceLayout
            header={
                <PageHeader
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    title={node.title}
                    action={action}
                    slug={node.slug}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                />
            }
            aside={webhookExample}
            reference={
                <TypeDefinitionRoot types={types} slug={node.slug}>
                    <TypeDefinitionSlotsServer types={types} lang={lang}>
                        <TypeDefinitionAnchorPart part="payload">
                            {webhook.headers && webhook.headers.length > 0 && (
                                <TypeDefinitionAnchorPart part="header">
                                    <EndpointSection title={t(lang).apiReference.headers}>
                                        <WithSeparator>
                                            {webhook.headers.map((parameter) => (
                                                <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                                    <ObjectProperty property={parameter} types={types} lang={lang} />
                                                </TypeDefinitionAnchorPart>
                                            ))}
                                        </WithSeparator>
                                    </EndpointSection>
                                </TypeDefinitionAnchorPart>
                            )}

                            {webhook.payloads?.[0] && (
                                <TypeDefinitionAnchorPart part="body">
                                    <EndpointSection
                                        title={t(lang).apiReference.payload}
                                        description={
                                            <Prose className="text-(color:--grayscale-a11) my-3" size="sm">
                                                {`The payload of this webhook request is ${renderTypeShorthand(webhook.payloads[0].shape, { withArticle: true }, types)}.`}
                                            </Prose>
                                        }
                                    >
                                        <TypeReferenceDefinitions
                                            shape={webhook.payloads?.[0].shape}
                                            types={types}
                                            lang={lang}
                                        />
                                    </EndpointSection>
                                </TypeDefinitionAnchorPart>
                            )}
                        </TypeDefinitionAnchorPart>

                        <TypeDefinitionAnchorPart part="response">
                            <EndpointSection title={t(lang).apiReference.response}>
                                {responses && responses.length > 0 ? (
                                    <div className="border-border-default rounded-3 flex flex-col overflow-visible border items-start">
                                        <WithSeparator>
                                            {responses.map((response, idx) => {
                                                const fallbackText = getMessageForStatus(response.statusCode);
                                                const displayText = response.description || fallbackText;
                                                return (
                                                    <div key={response.statusCode + idx} className="p-3">
                                                        <div className="flex items-start gap-2">
                                                            <StatusCodeBadge
                                                                statusCode={response.statusCode}
                                                                isWildcard={response.isWildcard}
                                                                size="sm"
                                                            />
                                                            {displayText && (
                                                                <div className="text-(--grayscale-a11) text-left text-xs">
                                                                    <Prose size="sm" className="inline">
                                                                        {response.description ? (
                                                                            <MdxServerComponentProseSuspense
                                                                                mdx={response.description}
                                                                                fallback={null}
                                                                            />
                                                                        ) : (
                                                                            fallbackText
                                                                        )}
                                                                    </Prose>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </WithSeparator>
                                    </div>
                                ) : (
                                    <WebhookResponseSection lang={lang} />
                                )}
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
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
