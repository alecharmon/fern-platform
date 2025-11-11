import "server-only";

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";

import { t } from "@fern-docs/i18n";
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
                        <EndpointAuthSection authOptions={authOptions} auths={auths} lang={lang} />
                    </TypeDefinitionAnchorPart>
                )}
                {endpoint.pathParameters && endpoint.pathParameters.length > 0 && (
                    <TypeDefinitionAnchorPart part="path">
                        <EndpointSection title={t(lang).apiReference.pathParameters}>
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
                        <EndpointSection title={t(lang).apiReference.headers}>
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
                        <EndpointSection title={t(lang).apiReference.queryParameters}>
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
                        <EndpointMultipleRequestSection requests={endpoint.requests} types={types} lang={lang} />
                    ) : (
                        <EndpointSection
                            title={t(lang).apiReference.request}
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
                            />
                        ) : (
                            <EndpointSection
                                title={t(lang).apiReference.response}
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
                            <EndpointSection title={t(lang).apiReference.errors} hideSeparator>
                                <EndpointErrorGroup errors={endpoint.errors} types={types} lang={lang} />
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}
