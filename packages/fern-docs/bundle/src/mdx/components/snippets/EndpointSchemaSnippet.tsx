import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";

import { EndpointRequestSection } from "@/components/api-reference/endpoints/EndpointRequestSection";
import { EndpointResponseSection } from "@/components/api-reference/endpoints/EndpointResponseSection";
import { EndpointSection } from "@/components/api-reference/endpoints/EndpointSection";
import { PropertyContainer } from "@/components/api-reference/endpoints/TypeDefinitionAnchor";
import { ObjectProperty } from "@/components/api-reference/type-definitions/ObjectProperty";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@/components/api-reference/type-definitions/TypeDefinitionDetails";
import { TypeDefinitionSlotsServer } from "@/components/api-reference/type-definitions/TypeDefinitionSlotsServer";

type EndpointSchemaSnippetProps = {
    /**
     * The endpoint locator to use for the request snippet.
     */
    endpoint?: string;
    /**
     * The selector of the endpoint.
     */
    selector: string | null;
    /**
     * @internal the rehype-endpoint-schema-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * @internal the rehype-endpoint-schema-snippets plugin will set this
     */
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang?: string;
    className?: string;
};

export function EndpointSchemaSnippet({
    endpoint,
    endpointDefinition,
    selector,
    types,
    lang,
    className
}: EndpointSchemaSnippetProps) {
    const currentSlug = useCurrentSlug();
    if (endpoint == null || endpointDefinition == null || types == null) {
        return null;
    }

    return (
        <TypeDefinitionRoot types={types} slug={currentSlug}>
            <TypeDefinitionSlotsServer types={types} lang={lang ?? "en"}>
                <EndpointSchemaSnippetInternal
                    endpoint={endpoint}
                    endpointDefinition={endpointDefinition}
                    selector={selector}
                    types={types}
                    lang={lang ?? "en"}
                    className={className}
                />
            </TypeDefinitionSlotsServer>
        </TypeDefinitionRoot>
    );
}

/**
 *  Utility function for checking the visibility of a section based on the selector
 *
 *  @param selector - The selector to check
 *  @param sectionPath - The path of the section to check
 *  @returns {boolean} - true if the section should be shown, false otherwise
 */
function shouldShowSection(selector: string | null, sectionPath: string): boolean {
    const allowAll = selector == null; // No selector means show everything
    const sectionRoot = sectionPath.split(".")[0];

    return (
        allowAll ||
        selector === sectionRoot || // Selector matches the section root (e.g. "request")
        selector === sectionPath // Selector matches the specific section (e.g. "request.path")
    );
}

export const EndpointSchemaSnippetInternal: React.FC<React.PropsWithChildren<EndpointSchemaSnippetProps>> = ({
    selector,
    endpoint,
    endpointDefinition,
    types,
    lang,
    className
}) => {
    if (endpoint == null || endpointDefinition == null || types == null) {
        return null;
    }

    const language = lang ?? "en";

    return (
        <div className={className}>
            {shouldShowSection(selector, "request.path") && endpointDefinition.pathParameters?.length && (
                <TypeDefinitionAnchorPart part="path">
                    <EndpointSection title="Path parameters">
                        <WithSeparator>
                            {endpointDefinition.pathParameters.map((parameter) => (
                                <ObjectProperty
                                    key={parameter.key}
                                    property={parameter}
                                    types={types}
                                    lang={language}
                                />
                            ))}
                        </WithSeparator>
                    </EndpointSection>
                </TypeDefinitionAnchorPart>
            )}
            {shouldShowSection(selector, "request.query") && endpointDefinition.queryParameters?.length && (
                <TypeDefinitionAnchorPart part="query">
                    <EndpointSection title="Query parameters">
                        <WithSeparator>
                            {endpointDefinition.queryParameters.map((parameter) => (
                                <PropertyContainer key={parameter.key}>
                                    <ObjectProperty property={parameter} types={types} lang={language} />
                                </PropertyContainer>
                            ))}
                        </WithSeparator>
                    </EndpointSection>
                </TypeDefinitionAnchorPart>
            )}
            {shouldShowSection(selector, "request.body") && endpointDefinition.requests?.[0] != null && (
                <TypeDefinitionAnchorPart part="request">
                    <EndpointSection key={endpointDefinition.requests[0].contentType} title="Request">
                        <EndpointRequestSection
                            request={endpointDefinition.requests[0]}
                            types={types}
                            lang={language}
                        />
                    </EndpointSection>
                </TypeDefinitionAnchorPart>
            )}
            {shouldShowSection(selector, "response.body") && endpointDefinition.responses?.[0] != null && (
                <TypeDefinitionAnchorPart part="response">
                    <EndpointSection title="Response">
                        <TypeDefinitionAnchorPart part="body">
                            <EndpointResponseSection
                                body={endpointDefinition.responses[0].body}
                                types={types}
                                lang={language}
                            />
                        </TypeDefinitionAnchorPart>
                    </EndpointSection>
                </TypeDefinitionAnchorPart>
            )}
        </div>
    );
};
