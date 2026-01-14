"use client";

/**
 * Dashboard-specific EndpointContentLeft (client-side MDX).
 *
 * Renders the left reference panel with auth, parameters, request/response bodies, and errors.
 * Uses dashboard's local type definition components for client-side MDX rendering.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/endpoints/EndpointContentLeft.tsx
 */

import type { EndpointContext } from "@fern-api/fdr-sdk/api-definition";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { EndpointAuthSection } from "@fern-docs/components/api-reference/endpoints/EndpointAuthSection";
import { EndpointMultipleRequestSection } from "@fern-docs/components/api-reference/endpoints/EndpointMultipleRequestSection";
import { EndpointMultipleResponseSection } from "@fern-docs/components/api-reference/endpoints/EndpointMultipleResponseSection";
import {
    createEndpointRequestDescriptionFallback,
    EndpointRequestSection as SharedEndpointRequestSection
} from "@fern-docs/components/api-reference/endpoints/EndpointRequestSection";
import { EndpointResponseSection as SharedEndpointResponseSection } from "@fern-docs/components/api-reference/endpoints/EndpointResponseSection";
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
import { useMemo } from "react";
import { DescriptionEditButton } from "@/components/editor/DescriptionEditButton";
import { MouseFollowingTooltip } from "@/components/editor/MouseFollowingTooltip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";
import { useApiEditTarget } from "@/providers/ApiEditTargetContext";
import { type DescriptionTarget, useDescriptionEditability, useLiveDescription } from "@/providers/OpenApiSpecsContext";
import { ObjectProperty, PropertyRenderer, PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeDefinitionRequest } from "../type-definitions/TypeDefinitionContext";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";
import { EndpointErrorGroup } from "./EndpointErrorGroup";

/** Shared endpoint info for description targets */
type EndpointInfo = { operationId?: string; method: string; path: string };

/** Renders either EditableDescription or plain MdxContent based on target availability */
function DescriptionOrFallback({
    target,
    description,
    fallback,
    size = "sm"
}: {
    target: DescriptionTarget | null;
    description: string | undefined;
    fallback?: ReactNode;
    size?: "xs" | "sm" | "base" | "lg";
}) {
    return target ? (
        <EditableDescription target={target} description={description} fallback={fallback} size={size} />
    ) : (
        <MdxContent size={size} className="text-(color:--grayscale-a11)" mdx={description} fallback={fallback} />
    );
}

/**
 * Editable form data field description component.
 */
function EditableFormDataFieldDescription({
    fieldKey,
    fieldType,
    description,
    endpointInfo
}: {
    fieldKey: string;
    fieldType: "file" | "files" | "property";
    description: string | undefined;
    endpointInfo?: EndpointInfo;
}) {
    const target = useMemo((): DescriptionTarget | null => {
        if (!endpointInfo) {
            return null;
        }
        return {
            type: "formDataField",
            operationId: endpointInfo.operationId,
            method: endpointInfo.method,
            path: endpointInfo.path,
            fieldKey,
            fieldType
        };
    }, [endpointInfo, fieldKey, fieldType]);

    const { isEditable, reason } = useDescriptionEditability(target);
    const liveDescription = useLiveDescription(target, description);

    // No target means we can't show edit UI
    if (!target) {
        return liveDescription ? (
            <MdxContent mdx={liveDescription} size="sm" className="text-(color:--grayscale-a11)" />
        ) : null;
    }

    // No description: show add button on hover (only if editable)
    if (!liveDescription) {
        if (isEditable) {
            return (
                <div className="group/desc opacity-0 transition-opacity hover:opacity-100">
                    <DescriptionEditButton target={target} currentValue="" />
                </div>
            );
        }
        // Non-editable with no description: nothing to show
        return null;
    }

    // Has description: editable gets edit button, non-editable gets mouse-following tooltip
    if (isEditable) {
        return (
            <div className="group/desc relative pr-6">
                <MdxContent mdx={liveDescription} size="sm" className="text-(color:--grayscale-a11)" />
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/desc:opacity-100">
                    <DescriptionEditButton target={target} currentValue={liveDescription} />
                </div>
            </div>
        );
    }

    return (
        <MouseFollowingTooltip reason={reason}>
            <MdxContent mdx={liveDescription} size="sm" className="text-(color:--grayscale-a11)" />
        </MouseFollowingTooltip>
    );
}

function renderFormDataFieldDescriptions(
    request: ApiDefinition.HttpRequest,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    endpointInfo?: EndpointInfo
): Record<string, ReactNode> {
    return visitDiscriminatedUnion(request.body)._visit<Record<string, ReactNode>>({
        formData: (formData) => {
            const result: Record<string, ReactNode> = {};
            for (const field of formData.fields) {
                visitDiscriminatedUnion(field, "type")._visit({
                    file: (file) => {
                        result[file.key] = (
                            <EditableFormDataFieldDescription
                                fieldKey={file.key}
                                fieldType="file"
                                description={file.description}
                                endpointInfo={endpointInfo}
                            />
                        );
                    },
                    files: (files) => {
                        result[files.key] = (
                            <EditableFormDataFieldDescription
                                fieldKey={files.key}
                                fieldType="files"
                                description={files.description}
                                endpointInfo={endpointInfo}
                            />
                        );
                    },
                    property: (property) => {
                        const description = compact([
                            property.description,
                            ...ApiDefinition.unwrapReference(property.valueShape, types).descriptions
                        ])[0];
                        result[property.key] = (
                            <EditableFormDataFieldDescription
                                fieldKey={property.key}
                                fieldType="property"
                                description={description}
                                endpointInfo={endpointInfo}
                            />
                        );
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

/**
 * Wrapper for descriptions that adds edit button support.
 * Uses useLiveDescription to show live updates after editing.
 * Shows an "add" button when description is empty and editable.
 */
function EditableDescription({
    target,
    description,
    fallback,
    size = "sm"
}: {
    target: DescriptionTarget;
    description: string | undefined;
    fallback?: ReactNode;
    size?: "xs" | "sm" | "base" | "lg";
}) {
    const { isEditable, reason } = useDescriptionEditability(target);

    // Get live value from specs context if available (enables UI updates after editing)
    const liveDescription = useLiveDescription(target, description);

    // Show "add" button when there's no actual description (even if there's a fallback)
    const hasActualDescription = !!liveDescription;

    // If no actual description, show edit button on hover (only if editable)
    if (!hasActualDescription) {
        if (isEditable) {
            return (
                <div className="group/desc">
                    {/* Render fallback content if available */}
                    {fallback && (
                        <MdxContent
                            mdx={undefined}
                            fallback={fallback}
                            size={size}
                            className="text-(color:--grayscale-a11)"
                        />
                    )}
                    {/* Add button appears on hover */}
                    <div className="opacity-0 transition-opacity group-hover/desc:opacity-100">
                        <DescriptionEditButton target={target} currentValue="" />
                    </div>
                </div>
            );
        }
        // Not editable with no description: show fallback with mouse-following tooltip
        if (fallback) {
            return (
                <MouseFollowingTooltip reason={reason}>
                    <MdxContent
                        mdx={undefined}
                        fallback={fallback}
                        size={size}
                        className="text-(color:--grayscale-a11)"
                    />
                </MouseFollowingTooltip>
            );
        }
        return null;
    }

    // Has description: editable gets edit button, non-editable gets mouse-following tooltip
    if (isEditable) {
        return (
            <div className="group/desc relative overflow-visible pr-6">
                <MdxContent
                    mdx={liveDescription}
                    fallback={fallback}
                    size={size}
                    className="text-(color:--grayscale-a11)"
                />
                <div className="absolute -right-1 top-1/2 z-10 -translate-y-1/2 opacity-0 transition-opacity group-hover/desc:opacity-100">
                    <DescriptionEditButton target={target} currentValue={liveDescription ?? ""} />
                </div>
            </div>
        );
    }

    return (
        <MouseFollowingTooltip reason={reason}>
            <MdxContent
                mdx={liveDescription}
                fallback={fallback}
                size={size}
                className="text-(color:--grayscale-a11)"
            />
        </MouseFollowingTooltip>
    );
}

export function EndpointContentLeft({
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
    const apiEditTarget = useApiEditTarget();

    // Build the path string for description targets
    const pathString = useMemo(() => {
        return endpoint.path.map((part) => (part.type === "literal" ? part.value : `{${part.value}}`)).join("");
    }, [endpoint.path]);

    // Shared endpoint info for description targets
    const endpointInfo = useMemo((): EndpointInfo | undefined => {
        if (!apiEditTarget || apiEditTarget.type !== "endpoint") {
            return undefined;
        }
        return { operationId: endpoint.operationId, method: endpoint.method, path: pathString };
    }, [apiEditTarget, endpoint.operationId, endpoint.method, pathString]);

    // Create request body target
    const requestBodyTarget = useMemo((): DescriptionTarget | null => {
        if (!endpointInfo) {
            return null;
        }
        return { type: "requestBody", ...endpointInfo };
    }, [endpointInfo]);

    // Create response target factory
    const createResponseTarget = (statusCode: number): DescriptionTarget | null => {
        if (!endpointInfo) {
            return null;
        }
        return { type: "response", ...endpointInfo, statusCode };
    };

    return (
        <>
            <TypeDefinitionRequest>
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
                                        <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                            <ObjectProperty
                                                property={parameter}
                                                types={types}
                                                lang={lang}
                                                parameterIn="path"
                                            />
                                        </TypeDefinitionAnchorPart>
                                    ))}
                                </WithSeparator>
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                    {headers.length > 0 && (
                        <TypeDefinitionAnchorPart part="header">
                            <EndpointSection
                                title={t(lang).apiReference.headers}
                                className="fern-endpoint-section-headers"
                            >
                                <WithSeparator>
                                    {headers.map((parameter) => (
                                        <TypeDefinitionAnchorPart key={parameter.key} part={parameter.key}>
                                            <ObjectProperty
                                                property={parameter}
                                                types={types}
                                                lang={lang}
                                                parameterIn="header"
                                            />
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
                                            <ObjectProperty
                                                property={parameter}
                                                types={types}
                                                lang={lang}
                                                parameterIn="query"
                                            />
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
                                lang={lang}
                                className="fern-endpoint-section-request-body"
                                renderedDescriptions={Object.fromEntries(
                                    endpoint.requests.map((request) => [
                                        request.contentType ?? "default",
                                        <DescriptionOrFallback
                                            key={request.contentType ?? "default"}
                                            target={requestBodyTarget}
                                            description={request.description}
                                            fallback={createEndpointRequestDescriptionFallback(request, types, lang)}
                                        />
                                    ])
                                )}
                                renderedBodies={Object.fromEntries(
                                    endpoint.requests.map((request) => [
                                        request.contentType ?? "default",
                                        <SharedEndpointRequestSection
                                            key={request.contentType ?? "default"}
                                            request={request}
                                            types={types}
                                            lang={lang}
                                            renderedFieldDescriptions={renderFormDataFieldDescriptions(
                                                request,
                                                types,
                                                endpointInfo
                                            )}
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
                                    <DescriptionOrFallback
                                        target={requestBodyTarget}
                                        description={endpoint.requests[0].description}
                                        fallback={createEndpointRequestDescriptionFallback(
                                            endpoint.requests[0],
                                            types,
                                            lang
                                        )}
                                    />
                                }
                            >
                                <TypeDefinitionAnchorPart part="body">
                                    <SharedEndpointRequestSection
                                        request={endpoint.requests[0]}
                                        types={types}
                                        lang={lang}
                                        renderedFieldDescriptions={renderFormDataFieldDescriptions(
                                            endpoint.requests[0],
                                            types,
                                            endpointInfo
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
            </TypeDefinitionRequest>
            <TypeDefinitionResponse key="response">
                <TypeDefinitionAnchorPart part="response">
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
                                        <DescriptionOrFallback
                                            key={response.statusCode}
                                            target={createResponseTarget(response.statusCode)}
                                            description={response.description}
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
                                        <SharedEndpointResponseSection
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
                                    <DescriptionOrFallback
                                        target={createResponseTarget(endpoint.responses[0].statusCode)}
                                        description={endpoint.responses[0].description}
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
                                    <SharedEndpointResponseSection
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
                                <EndpointErrorGroup
                                    errors={endpoint.errors}
                                    types={types}
                                    lang={lang}
                                    endpointInfo={endpointInfo}
                                />
                            </EndpointSection>
                        </TypeDefinitionAnchorPart>
                    )}
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}
