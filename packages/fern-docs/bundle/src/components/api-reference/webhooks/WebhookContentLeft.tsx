import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { getMessageForStatus } from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { EndpointSection } from "@fern-docs/components/api-reference/endpoints/EndpointSection";
import { TypeDefinitionAnchorPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { StatusCodeBadge } from "@fern-docs/components/badges";
import { Prose } from "@fern-docs/components/mdx/prose";
import { renderTypeShorthand } from "@fern-docs/components/type-shorthand";
import { t } from "@fern-docs/i18n";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import { ObjectProperty, PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";
import { WebhookResponseSection } from "./WebhookResponseSection";

function renderTypeShorthandFormDataField(
    field: Exclude<ApiDefinition.FormDataField, ApiDefinition.FormDataField.Property>,
    lang: string
): React.ReactNode {
    return (
        <span className="fern-api-property-meta">
            <span className="fern-api-property-type">{field.type}</span>
            {field.isOptional ? (
                <span className="fern-api-property-optional">{t(lang).apiReference.optional}</span>
            ) : (
                <span className="fern-api-property-required text-(color:--red-a11)">
                    {t(lang).apiReference.required}
                </span>
            )}
        </span>
    );
}

function WebhookPayloadSection({
    payload,
    types,
    lang
}: {
    payload: ApiDefinition.WebhookPayload;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang: string;
}) {
    return visitDiscriminatedUnion(payload.shape)._visit({
        object: (obj) => (
            <EndpointSection
                title={t(lang).apiReference.payload}
                description={
                    <Prose className="text-(color:--grayscale-a11) my-3" size="sm">
                        {`The payload of this webhook request is ${renderTypeShorthand(obj, { withArticle: true }, types)}.`}
                    </Prose>
                }
            >
                <TypeReferenceDefinitions shape={obj} types={types} lang={lang} />
            </EndpointSection>
        ),
        alias: (alias) => (
            <EndpointSection
                title={t(lang).apiReference.payload}
                description={
                    <Prose className="text-(color:--grayscale-a11) my-3" size="sm">
                        {`The payload of this webhook request is ${renderTypeShorthand(alias, { withArticle: true }, types)}.`}
                    </Prose>
                }
            >
                <TypeReferenceDefinitions shape={alias} types={types} lang={lang} />
            </EndpointSection>
        ),
        formData: (formData) => (
            <EndpointSection
                title={t(lang).apiReference.payload}
                description={
                    <Prose className="text-(color:--grayscale-a11) my-3" size="sm">
                        The payload of this webhook request is a multipart form.
                    </Prose>
                }
            >
                <WithSeparator>
                    {formData.fields.map((field) =>
                        visitDiscriminatedUnion(field, "type")._visit({
                            file: (file) => (
                                <TypeDefinitionAnchorPart part={file.key} key={file.key}>
                                    <PropertyRenderer
                                        name={file.key}
                                        description={file.description ?? undefined}
                                        typeShorthand={renderTypeShorthandFormDataField(file, lang)}
                                        availability={file.availability}
                                    />
                                </TypeDefinitionAnchorPart>
                            ),
                            files: (files) => (
                                <TypeDefinitionAnchorPart part={files.key} key={files.key}>
                                    <PropertyRenderer
                                        name={files.key}
                                        description={files.description ?? undefined}
                                        typeShorthand={renderTypeShorthandFormDataField(files, lang)}
                                        availability={files.availability}
                                    />
                                </TypeDefinitionAnchorPart>
                            ),
                            property: (property) => (
                                <TypeDefinitionAnchorPart part={property.key} key={property.key}>
                                    <PropertyWithShape
                                        name={property.key}
                                        description={property.description ?? undefined}
                                        shape={property.valueShape}
                                        availability={property.availability}
                                        types={types}
                                        lang={lang}
                                    />
                                </TypeDefinitionAnchorPart>
                            ),
                            _other: () => null
                        })
                    )}
                </WithSeparator>
            </EndpointSection>
        ),
        _other: () => null
    });
}

export function WebhookContentLeft({
    context,
    lang,
    showUnionsAsDropdown = false
}: {
    context: ApiDefinition.WebhookContext;
    lang: string;
    showUnionsAsDropdown?: boolean;
}) {
    const { webhook, types } = context;
    const responses = webhook.responses;

    return (
        <>
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
                        <WebhookPayloadSection payload={webhook.payloads[0]} types={types} lang={lang} />
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
                                                    isWildcard={response.isWildcard ?? undefined}
                                                    size="sm"
                                                />
                                                {displayText && (
                                                    <div className="text-(--grayscale-a11) text-left text-xs">
                                                        <Prose size="sm" className="inline">
                                                            {response.description ? (
                                                                <MdxServerComponentProseSuspense
                                                                    size="sm"
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
        </>
    );
}
