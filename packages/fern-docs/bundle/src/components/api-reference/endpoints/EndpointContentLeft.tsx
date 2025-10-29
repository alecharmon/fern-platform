import "server-only";

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";

import { i18n } from "@/constants";
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

export interface HoveringProps {
    isHovering: boolean;
}

export async function EndpointContentLeft({
    context: { endpoint, types, auths, globalHeaders },
    showAuth,
    showErrors
}: {
    context: EndpointContext;
    showAuth: boolean;
    showErrors: boolean;
}) {
    const headers = [...globalHeaders, ...(endpoint.requestHeaders ?? [])];

    return (
        <>
            <TypeDefinitionAnchorPart part="request">
                {showAuth && auths.length > 0 && (
                    <TypeDefinitionAnchorPart part="auth">
                        <EndpointAuthSection auths={auths} />
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.pathParameters && endpoint.pathParameters.length > 0 && (
                    <TypeDefinitionAnchorPart part="path">
                        <EndpointSection title={i18n.apiReference.pathParameters}>
                            <WithSeparator>
                                {endpoint.pathParameters.map((parameter) => (
                                    <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                        <ObjectProperty property={parameter} types={types} />
                                    </TypeDefinitionAnchorPart>
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {headers.length > 0 && (
                    <TypeDefinitionAnchorPart part="header">
                        <EndpointSection title={i18n.apiReference.headers}>
                            <WithSeparator>
                                {headers.map((parameter) => (
                                    <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                        <ObjectProperty property={parameter} types={types} />
                                    </TypeDefinitionAnchorPart>
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.queryParameters && endpoint.queryParameters.length > 0 && (
                    <TypeDefinitionAnchorPart part="query">
                        <EndpointSection title={i18n.apiReference.queryParameters}>
                            <WithSeparator>
                                {endpoint.queryParameters.map((parameter) => (
                                    <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                        <ObjectProperty property={parameter} types={types} />
                                    </TypeDefinitionAnchorPart>
                                ))}
                            </WithSeparator>
                        </EndpointSection>
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.requests?.[0] != null ? (
                    endpoint.requests.length > 1 ? (
                        <EndpointMultipleRequestSection requests={endpoint.requests} types={types} />
                    ) : (
                        <EndpointSection
                            title={i18n.apiReference.request}
                            description={
                                <MdxServerComponentProseSuspense
                                    size="sm"
                                    className="text-(color:--grayscale-a11)"
                                    mdx={endpoint.requests[0].description}
                                    fallback={createEndpointRequestDescriptionFallback(endpoint.requests[0], types)}
                                />
                            }
                        >
                            <TypeDefinitionAnchorPart part="body">
                                <EndpointRequestSection request={endpoint.requests[0]} types={types} />
                            </TypeDefinitionAnchorPart>
                        </EndpointSection>
                    )
                ) : null}
            </TypeDefinitionAnchorPart>
            <TypeDefinitionResponse>
                <TypeDefinitionAnchorPart part="response">
                    {endpoint.responses?.[0] != null ? (
                        endpoint.responses.length > 1 ? (
                            <EndpointMultipleResponseSection
                                method={endpoint.method}
                                responses={endpoint.responses}
                                types={types}
                            />
                        ) : (
                            <EndpointSection
                                title={i18n.apiReference.response}
                                description={
                                    <MdxServerComponentProseSuspense
                                        size="sm"
                                        className="text-(color:--grayscale-a11)"
                                        mdx={endpoint.responses[0].description}
                                        fallback={
                                            <ResponseSummaryFallback response={endpoint.responses[0]} types={types} />
                                        }
                                    />
                                }
                            >
                                <TypeDefinitionAnchorPart part="body">
                                    <EndpointResponseSection body={endpoint.responses[0].body} types={types} />
                                </TypeDefinitionAnchorPart>
                            </EndpointSection>
                        )
                    ) : null}
                    {showErrors && endpoint.errors && endpoint.errors.length > 0 && (
                        <TypeDefinitionAnchorPart part="error">
                            <EndpointSection title={i18n.apiReference.errors} hideSeparator>
                                <EndpointErrorGroup errors={endpoint.errors} types={types} />
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}
