import "server-only";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { Prose } from "@fern-docs/components/mdx/prose";
import { FooterLayout } from "@/components/layouts/FooterLayout";
import { PageHeader } from "@/components/PageHeader";
import { renderTypeShorthand } from "@/components/type-shorthand";
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
    markdownPromise
}: {
    serialize: MdxSerializer;
    context: ApiDefinition.WebhookContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation: React.ReactNode;
    action?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
}) {
    const { node, webhook, types } = context;

    const example = webhook.examples?.[0]; // TODO: Need a way to show all the examples

    const webhookExample = example ? <WebhookExample example={example} slug={node.slug} /> : null;

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
                />
            }
            aside={webhookExample}
            reference={
                <TypeDefinitionRoot types={types} slug={node.slug}>
                    <TypeDefinitionSlotsServer types={types}>
                        <TypeDefinitionAnchorPart part="payload">
                            {webhook.headers && webhook.headers.length > 0 && (
                                <TypeDefinitionAnchorPart part="header">
                                    <EndpointSection title="Headers">
                                        <WithSeparator>
                                            {webhook.headers.map((parameter) => (
                                                <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                                    <ObjectProperty property={parameter} types={types} />
                                                </TypeDefinitionAnchorPart>
                                            ))}
                                        </WithSeparator>
                                    </EndpointSection>
                                </TypeDefinitionAnchorPart>
                            )}

                            {webhook.payloads?.[0] && (
                                <TypeDefinitionAnchorPart part="body">
                                    <EndpointSection
                                        title="Payload"
                                        description={
                                            <Prose className="text-(color:--grayscale-a11) my-3" size="sm">
                                                {`The payload of this webhook request is ${renderTypeShorthand(webhook.payloads[0].shape, { withArticle: true }, types)}.`}
                                            </Prose>
                                        }
                                    >
                                        <TypeReferenceDefinitions shape={webhook.payloads?.[0].shape} types={types} />
                                    </EndpointSection>
                                </TypeDefinitionAnchorPart>
                            )}
                        </TypeDefinitionAnchorPart>

                        <TypeDefinitionAnchorPart part="response">
                            <EndpointSection title="Response">
                                <WebhookResponseSection />
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    </TypeDefinitionSlotsServer>
                </TypeDefinitionRoot>
            }
            footer={<FooterLayout bottomNavigation={bottomNavigation} hideFeedback={hideFeedback} />}
        >
            <MdxServerComponentProseSuspense mdx={webhook.description} />
        </ReferenceLayout>
    );
}
