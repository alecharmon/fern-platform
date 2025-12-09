import "server-only";

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { t } from "@fern-docs/i18n";
import { compact } from "es-toolkit/array";
import type { ReactNode } from "react";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { ObjectProperty } from "../type-definitions/ObjectProperty";
import { TypeDefinitionAnchorPart, TypeDefinitionResponse } from "../type-definitions/TypeDefinitionContext";
import { WithSeparator } from "../type-definitions/TypeDefinitionDetails";
import { EndpointAuthSection } from "./EndpointAuthSection";
import { EndpointErrorGroup } from "./EndpointErrorGroup";
import { EndpointMultipleRequestSection } from "./EndpointMultipleRequestSection";
import { EndpointMultipleResponseSection } from "./EndpointMultipleResponseSection";
import { createEndpointRequestDescriptionFallback, EndpointRequestSection } from "./EndpointRequestSection";
import { EndpointResponseSection } from "./EndpointResponseSection";
import { EndpointSection } from "./EndpointSection";
import { ResponseSummaryFallback } from "./response-summary-fallback";

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
                                    <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                        <ObjectProperty property={parameter} types={types} lang={lang} />
                                    </TypeDefinitionAnchorPart>
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
                                    <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                        <ObjectProperty property={parameter} types={types} lang={lang} />
                                    </TypeDefinitionAnchorPart>
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
                                    <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                        <ObjectProperty property={parameter} types={types} lang={lang} />
                                    </TypeDefinitionAnchorPart>
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.requests?.[0] != null ? (
                    endpoint.requests.length > 1 ? (
                        <EndpointMultipleRequestSection
                            requests={endpoint.requests}
                            types={types}
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
                            renderedFieldDescriptions={Object.fromEntries(
                                endpoint.requests.map((request) => [
                                    request.contentType ?? "default",
                                    renderFormDataFieldDescriptions(request, types)
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
                                <EndpointRequestSection request={endpoint.requests[0]} types={types} lang={lang} />
                            </TypeDefinitionAnchorPart>
                        </EndpointSection>
                    )
                ) : null}
            </TypeDefinitionAnchorPart>
            <TypeDefinitionResponse key="response">
                <TypeDefinitionAnchorPart part="response">
                    {endpoint.responses?.[0] != null ? (
                        endpoint.responses.length > 1 ? (
                            <EndpointMultipleResponseSection
                                method={endpoint.method}
                                responses={endpoint.responses}
                                types={types}
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
