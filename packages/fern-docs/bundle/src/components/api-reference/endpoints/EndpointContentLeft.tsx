import "server-only";

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { EndpointAuthSection } from "@fern-docs/components/api-reference/endpoints/EndpointAuthSection";
import { EndpointMultipleRequestSection } from "@fern-docs/components/api-reference/endpoints/EndpointMultipleRequestSection";
import { EndpointMultipleResponseSection } from "@fern-docs/components/api-reference/endpoints/EndpointMultipleResponseSection";
import {
    createEndpointRequestDescriptionFallback,
    EndpointRequestSection
} from "@fern-docs/components/api-reference/endpoints/EndpointRequestSection";
import { EndpointResponseSection } from "@fern-docs/components/api-reference/endpoints/EndpointResponseSection";
import { EndpointSection } from "@fern-docs/components/api-reference/endpoints/EndpointSection";
import { ResponseSummaryFallback } from "@fern-docs/components/api-reference/endpoints/response-summary-fallback";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionResponse
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { t } from "@fern-docs/i18n";
import { compact } from "es-toolkit/array";
import type { ReactNode } from "react";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { ObjectProperty, PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";
import { EndpointErrorGroup } from "./EndpointErrorGroup";

function renderFormDataFieldDescriptions(
    request: ApiDefinition.HttpRequest,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): Record<string, ReactNode> {
    return visitDiscriminatedUnion(request.body)._visit<Record<string, ReactNode>>({
        formData: (formData) => {
            const result: Record<string, ReactNode> = {};
            for (const field of formData.fields) {
                visitDiscriminatedUnion(field, "type")._visit({
                    file: (file) => {
                        if (file.description) {
                            result[file.key] = (
                                <MdxServerComponentProseSuspense
                                    mdx={file.description}
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                />
                            );
                        }
                    },
                    files: (files) => {
                        if (files.description) {
                            result[files.key] = (
                                <MdxServerComponentProseSuspense
                                    mdx={files.description}
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                />
                            );
                        }
                    },
                    property: (property) => {
                        const description = compact([
                            property.description,
                            ...ApiDefinition.unwrapReference(property.valueShape, types).descriptions
                        ])[0];
                        if (description) {
                            result[property.key] = (
                                <MdxServerComponentProseSuspense
                                    mdx={description}
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                />
                            );
                        }
                    },
                    _other: () => {}
                });
            }
            return result;
        },
        bytes: () => ({}),
        object: () => ({}),
        alias: () => ({})
    });
}

export interface HoveringProps {
    isHovering: boolean;
}

export async function EndpointContentLeft({
    context: { endpoint, types, auths, authOptions, globalHeaders },
    showAuth,
    showErrors,
    lang
}: {
    context: EndpointContext;
    showAuth: boolean;
    showErrors: boolean;
    lang: string;
}) {
    const headers = [...globalHeaders, ...(endpoint.requestHeaders ?? [])];

    return (
        <>
            <TypeDefinitionAnchorPart key="request" part="request">
                {showAuth && (authOptions.length > 0 || auths.length > 0) && (
                    <TypeDefinitionAnchorPart part="auth">
                        <EndpointAuthSection
                            authOptions={authOptions}
                            auths={auths}
                            lang={lang}
                            className="fern-endpoint-section-auth"
                            PropertyRenderer={PropertyRenderer}
                        />
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.pathParameters && endpoint.pathParameters.length > 0 && (
                    <TypeDefinitionAnchorPart part="path">
                        <EndpointSection
                            title={t(lang).apiReference.pathParameters}
                            className="fern-endpoint-section-path-parameters"
                        >
                            <WithSeparator>
                                {endpoint.pathParameters.map((parameter) => (
                                    <ObjectProperty
                                        key={parameter.key}
                                        property={parameter}
                                        types={types}
                                        lang={lang}
                                    />
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {headers.length > 0 && (
                    <TypeDefinitionAnchorPart part="header">
                        <EndpointSection title={t(lang).apiReference.headers} className="fern-endpoint-section-headers">
                            <WithSeparator>
                                {headers.map((parameter) => (
                                    <ObjectProperty
                                        key={parameter.key}
                                        property={parameter}
                                        types={types}
                                        lang={lang}
                                    />
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.queryParameters && endpoint.queryParameters.length > 0 && (
                    <TypeDefinitionAnchorPart part="query">
                        <EndpointSection
                            title={t(lang).apiReference.queryParameters}
                            className="fern-endpoint-section-query-parameters"
                        >
                            <WithSeparator>
                                {endpoint.queryParameters.map((parameter) => (
                                    <ObjectProperty
                                        key={parameter.key}
                                        property={parameter}
                                        types={types}
                                        lang={lang}
                                    />
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.requests?.[0] != null ? (
                    endpoint.requests.length > 1 ? (
                        <EndpointMultipleRequestSection
                            requests={endpoint.requests}
                            lang={lang}
                            className="fern-endpoint-section-request-body"
                            renderedDescriptions={Object.fromEntries(
                                endpoint.requests.map((request) => [
                                    request.contentType ?? "default",
                                    <MdxServerComponentProseSuspense
                                        key={request.contentType ?? "default"}
                                        size="sm"
                                        className="text-(color:--grayscale-a11)"
                                        mdx={request.description}
                                        fallback={createEndpointRequestDescriptionFallback(request, types, lang)}
                                    />
                                ])
                            )}
                            renderedBodies={Object.fromEntries(
                                endpoint.requests.map((request) => [
                                    request.contentType ?? "default",
                                    <EndpointRequestSection
                                        key={request.contentType ?? "default"}
                                        request={request}
                                        types={types}
                                        lang={lang}
                                        renderedFieldDescriptions={renderFormDataFieldDescriptions(request, types)}
                                        PropertyRenderer={PropertyRenderer}
                                        PropertyWithShape={PropertyWithShape}
                                        TypeReferenceDefinitions={TypeReferenceDefinitions}
                                    />
                                ])
                            )}
                        />
                    ) : (
                        <EndpointSection
                            title={t(lang).apiReference.request}
                            className="fern-endpoint-section-request-body"
                            description={
                                <MdxServerComponentProseSuspense
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                    mdx={endpoint.requests[0].description}
                                    fallback={createEndpointRequestDescriptionFallback(
                                        endpoint.requests[0],
                                        types,
                                        lang
                                    )}
                                />
                            }
                        >
                            <TypeDefinitionAnchorPart part="body">
                                <EndpointRequestSection
                                    request={endpoint.requests[0]}
                                    types={types}
                                    lang={lang}
                                    renderedFieldDescriptions={renderFormDataFieldDescriptions(
                                        endpoint.requests[0],
                                        types
                                    )}
                                    PropertyRenderer={PropertyRenderer}
                                    PropertyWithShape={PropertyWithShape}
                                    TypeReferenceDefinitions={TypeReferenceDefinitions}
                                />
                            </TypeDefinitionAnchorPart>
                        </EndpointSection>
                    )
                ) : null}
            </TypeDefinitionAnchorPart>
            <TypeDefinitionResponse key="response">
                <TypeDefinitionAnchorPart part="response">
                    {endpoint.responseHeaders && endpoint.responseHeaders.length > 0 && (
                        <TypeDefinitionAnchorPart part="response-header">
                            <EndpointSection
                                title={t(lang).apiReference.responseHeaders}
                                className="fern-endpoint-section-response-headers"
                            >
                                <WithSeparator>
                                    {endpoint.responseHeaders.map((header) => (
                                        <ObjectProperty key={header.key} property={header} types={types} lang={lang} />
                                    ))}
                                </WithSeparator>
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                    {endpoint.responses?.[0] != null ? (
                        endpoint.responses.length > 1 ? (
                            <EndpointMultipleResponseSection
                                method={endpoint.method}
                                responses={endpoint.responses}
                                lang={lang}
                                className="fern-endpoint-section-response-body"
                                renderedDescriptions={Object.fromEntries(
                                    endpoint.responses.map((response) => [
                                        response.statusCode,
                                        <MdxServerComponentProseSuspense
                                            key={response.statusCode}
                                            size="sm"
                                            className="text-(color:--grayscale-a11)"
                                            mdx={response.description}
                                            fallback={
                                                <ResponseSummaryFallback
                                                    response={response}
                                                    types={types}
                                                    lang={lang}
                                                />
                                            }
                                        />
                                    ])
                                )}
                                renderedBodies={Object.fromEntries(
                                    endpoint.responses.map((response) => [
                                        response.statusCode,
                                        <EndpointResponseSection
                                            key={response.statusCode}
                                            body={response.body}
                                            types={types}
                                            lang={lang}
                                            TypeReferenceDefinitions={TypeReferenceDefinitions}
                                        />
                                    ])
                                )}
                            />
                        ) : (
                            <EndpointSection
                                title={t(lang).apiReference.response}
                                className="fern-endpoint-section-response-body"
                                description={
                                    <MdxServerComponentProseSuspense
                                        size="sm"
                                        className="text-(color:--grayscale-a11)"
                                        mdx={endpoint.responses[0].description}
                                        fallback={
                                            <ResponseSummaryFallback
                                                response={endpoint.responses[0]}
                                                types={types}
                                                lang={lang}
                                            />
                                        }
                                    />
                                }
                            >
                                <TypeDefinitionAnchorPart part="body">
                                    <EndpointResponseSection
                                        body={endpoint.responses[0].body}
                                        types={types}
                                        lang={lang}
                                        TypeReferenceDefinitions={TypeReferenceDefinitions}
                                    />
                                </TypeDefinitionAnchorPart>
                            </EndpointSection>
                        )
                    ) : null}
                    {showErrors && endpoint.errors && endpoint.errors.length > 0 && (
                        <TypeDefinitionAnchorPart part="error">
                            <EndpointSection
                                title={t(lang).apiReference.errors}
                                hideSeparator
                                className="fern-endpoint-section-errors"
                            >
                                <EndpointErrorGroup errors={endpoint.errors} types={types} lang={lang} />
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}
