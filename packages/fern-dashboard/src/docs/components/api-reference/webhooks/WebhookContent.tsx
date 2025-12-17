"use client";

/**
 * Dashboard-specific WebhookContent (client-side, read-only).
 *
 * Main component for rendering Webhook API reference pages.
 * Uses ReferenceLayout with header, payload example, and response sections.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/webhooks/WebhookContent.tsx
 */

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { getMessageForStatus } from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { EndpointSection } from "@fern-docs/components/api-reference/endpoints/EndpointSection";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { WebhookExample } from "@fern-docs/components/api-reference/webhooks/WebhookExample";
import { StatusCodeBadge } from "@fern-docs/components/badges";
import { FernBreadcrumbs } from "@fern-docs/components/FernBreadcrumbs";
import { ReferenceLayout } from "@fern-docs/components/layouts/ReferenceLayout";
import { Prose } from "@fern-docs/components/mdx/prose";
import { renderTypeShorthand } from "@fern-docs/components/type-shorthand";
import { t } from "@fern-docs/i18n";

import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { ObjectProperty } from "../type-definitions/ObjectProperty";
import { TypeDefinitionSlotsServer } from "../type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

export interface WebhookContentProps {
    context: ApiDefinition.WebhookContext;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    lang: string;
}

export function WebhookContent({ context, breadcrumb, lang }: WebhookContentProps) {
    const { node, webhook, types } = context;

    const example = webhook.examples?.[0];
    const responses = webhook.responses;

    const webhookExample = example ? <WebhookExample example={example} slug={node.slug} lang={lang} /> : null;

    return (
        <ReferenceLayout
            header={<WebhookPageHeader breadcrumb={breadcrumb} title={node.title} />}
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
                                            shape={webhook.payloads[0].shape}
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
                                                                            <MdxContent
                                                                                size="sm"
                                                                                mdx={response.description}
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
        >
            <MdxContent mdx={webhook.description} />
        </ReferenceLayout>
    );
}

/**
 * Simplified page header for dashboard (no page actions)
 */
function WebhookPageHeader({
    breadcrumb,
    title
}: {
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    title: string;
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
                </div>
            </div>
        </header>
    );
}

/**
 * Default webhook response section showing 200 status
 */
function WebhookResponseSection({ lang }: { lang: string }) {
    return (
        <div className="border-border-default rounded-3/2 flex flex-col overflow-hidden border">
            <div className="flex flex-col items-start p-3">
                <div className="flex items-baseline space-x-2">
                    <div className="rounded-1 bg-green-500/20 p-1 text-xs text-green-400">{200}</div>
                    <div className="text-(color:--grayscale-a11) text-xs">{t(lang).apiReference.any}</div>
                </div>

                <Prose size="sm" className="mt-3 text-start">
                    {t(lang).responses.return200Status}
                </Prose>
            </div>
        </div>
    );
}
