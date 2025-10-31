"use client";

import { WithSeparator } from "@fern-api/endpoint-snippet-dependencies";
import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { TextInputControl } from "@/components/editor/editor-component/controls";
import { useEditorComponent } from "@/components/editor/editor-component/EditorComponentContext";
import {
    EditorComponentPopoverButton,
    EditorComponentPopoverProvider
} from "@/components/editor/editor-component/EditorComponentPopover";
import { EndpointRequestSection } from "@/docs/components/api-reference/endpoints/EndpointRequestSection";
import { EndpointResponseSection } from "@/docs/components/api-reference/endpoints/EndpointResponseSection";
import { EndpointSection } from "@/docs/components/api-reference/endpoints/EndpointSection";
import { PropertyContainer } from "@/docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import { ObjectProperty } from "@/docs/components/api-reference/type-definitions/ObjectProperty";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@/docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { TypeDefinitionSlotsServer } from "@/docs/components/api-reference/type-definitions/TypeDefinitionSlotsServer";

import { EditorPreviewBanner } from "./EditorPreviewBanner";
import { EndpointNotFoundState } from "./EndpointNotFoundState";

/* eslint-disable unused-imports/no-unused-vars */

export const EMPTY_ENDPOINT_SCHEMA_SNIPPET = `
<EndpointSchemaSnippet endpoint="" />
`;

type EndpointSchemaSnippetProps = {
    /**
     * The endpoint locator to use for the schema snippet.
     */
    endpoint?: string;
    /**
     * The selector of the endpoint sections to display.
     */
    selector?: string | null;
    /**
     * @internal the rehype-endpoint-schema-snippets plugin will set this
     */
    endpointDefinition?: ApiDefinition.EndpointDefinition;
    /**
     * @internal the rehype-endpoint-schema-snippets plugin will set this
     */
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    className?: string;
};

export function EndpointSchemaSnippet({
    endpoint,
    endpointDefinition,
    selector,
    types,
    className
}: EndpointSchemaSnippetProps) {
    const { isWithinEditor } = useEditorComponent();
    const snippetRef = useRef<HTMLDivElement>(null);

    if (endpointDefinition == null || types == null) {
        const notFoundContent = <EndpointNotFoundState endpointProp={endpoint} snippetRef={snippetRef} />;

        if (isWithinEditor) {
            return (
                <EditorComponentPopoverProvider
                    attributes={{
                        endpoint: new TextInputControl({ defaultValue: endpoint })
                    }}
                    targetRef={snippetRef}
                    buttonAlwaysVisible
                >
                    {notFoundContent}
                </EditorComponentPopoverProvider>
            );
        }

        return notFoundContent;
    }

    return (
        <EndpointSchemaSnippetInternal
            endpoint={endpoint}
            endpointDefinition={endpointDefinition}
            selector={selector ?? null}
            types={types}
            className={className}
            endpointProp={endpoint}
        />
    );
}

function EndpointSchemaSnippetInternal({
    endpoint,
    endpointDefinition,
    selector,
    types,
    className,
    endpointProp
}: {
    endpoint?: string;
    endpointDefinition: ApiDefinition.EndpointDefinition;
    selector: string | null;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    className?: string;
    endpointProp?: string;
}) {
    const { isWithinEditor } = useEditorComponent();
    const currentSlug = usePathname();
    const snippetRef = useRef<HTMLDivElement>(null);

    const snippetContent = (
        <div ref={snippetRef} className={className}>
            <div className="bg-card-background border-card-border rounded-3 shadow-card-grayscale relative flex flex-col overflow-hidden border">
                {isWithinEditor && (
                    <EditorComponentPopoverButton
                        className="absolute right-2 top-0.5 z-10"
                        componentName="Endpoint Schema Snippet"
                    />
                )}
                <TypeDefinitionRoot types={types} slug={currentSlug}>
                    <TypeDefinitionSlotsServer types={types}>
                        <div className="space-y-4 p-4">
                            {shouldShowSection(selector, "request.path") &&
                                endpointDefinition.pathParameters?.length && (
                                    <TypeDefinitionAnchorPart part="path">
                                        <EndpointSection title="Path parameters">
                                            <WithSeparator>
                                                {endpointDefinition.pathParameters.map((parameter) => (
                                                    <ObjectProperty
                                                        key={parameter.key}
                                                        property={parameter}
                                                        types={types}
                                                    />
                                                ))}
                                            </WithSeparator>
                                        </EndpointSection>
                                    </TypeDefinitionAnchorPart>
                                )}
                            {shouldShowSection(selector, "request.query") &&
                                endpointDefinition.queryParameters?.length && (
                                    <TypeDefinitionAnchorPart part="query">
                                        <EndpointSection title="Query parameters">
                                            <WithSeparator>
                                                {endpointDefinition.queryParameters.map((parameter) => (
                                                    <PropertyContainer key={parameter.key}>
                                                        <ObjectProperty property={parameter} types={types} />
                                                    </PropertyContainer>
                                                ))}
                                            </WithSeparator>
                                        </EndpointSection>
                                    </TypeDefinitionAnchorPart>
                                )}
                            {shouldShowSection(selector, "request.body") &&
                                endpointDefinition.requests?.[0] != null && (
                                    <TypeDefinitionAnchorPart part="request">
                                        <EndpointSection
                                            key={endpointDefinition.requests[0].contentType}
                                            title="Request"
                                        >
                                            <EndpointRequestSection
                                                request={endpointDefinition.requests[0]}
                                                types={types}
                                            />
                                        </EndpointSection>
                                    </TypeDefinitionAnchorPart>
                                )}
                            {shouldShowSection(selector, "response.body") &&
                                endpointDefinition.responses?.[0] != null && (
                                    <TypeDefinitionAnchorPart part="response">
                                        <EndpointSection title="Response">
                                            <TypeDefinitionAnchorPart part="body">
                                                <EndpointResponseSection
                                                    body={endpointDefinition.responses[0].body}
                                                    types={types}
                                                />
                                            </TypeDefinitionAnchorPart>
                                        </EndpointSection>
                                    </TypeDefinitionAnchorPart>
                                )}
                        </div>
                    </TypeDefinitionSlotsServer>
                </TypeDefinitionRoot>
                <EditorPreviewBanner name="EndpointSchemaSnippet" />
            </div>
        </div>
    );

    if (isWithinEditor) {
        return (
            <EditorComponentPopoverProvider
                attributes={{
                    endpoint: new TextInputControl({ defaultValue: endpointProp })
                }}
                targetRef={snippetRef}
                buttonAlwaysVisible
            >
                {snippetContent}
            </EditorComponentPopoverProvider>
        );
    }

    return snippetContent;
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
