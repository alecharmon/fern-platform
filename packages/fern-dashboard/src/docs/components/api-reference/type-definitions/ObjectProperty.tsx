"use client";

/**
 * Dashboard-specific ObjectProperty (client-side MDX).
 *
 * Props mirror @fern-docs/bundle ObjectProperty for interface compatibility with shared
 * components. Uses local TypeReferenceDefinitions to form a closed recursive loop where
 * all nested types render descriptions client-side via MdxContent.
 *
 * Includes edit button support for description editing in the Editor.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/type-definitions/ObjectProperty.tsx
 */
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import {
    PropertyContainer,
    TypeDefinitionAnchor
} from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import type { JsonPropertyPath } from "@fern-docs/components/api-reference/examples/JsonPropertyPath";
import { PropertyKey } from "@fern-docs/components/api-reference/type-definitions/PropertyKey";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionCollapsible,
    useTypeDefinitionContext
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { compact } from "es-toolkit/array";
import React, { useMemo } from "react";

import { DescriptionEditButton } from "@/components/editor/DescriptionEditButton";
import { MouseFollowingTooltip } from "@/components/editor/MouseFollowingTooltip";
import { MdxContent } from "@/docs/mdx/components/MdxContent";
import { useApiEditTarget } from "@/providers/ApiEditTargetContext";
import { type DescriptionTarget, useDescriptionEditability, useLiveDescription } from "@/providers/OpenApiSpecsContext";

import { type PropertyLocation, TypeReferenceDefinitions } from "./TypeReferenceDefinitions";
import { TypeShorthand } from "./TypeShorthand";

/**
 * Extract property names from JsonPropertyPath.
 */
function extractPropertyPath(jsonPropertyPath: JsonPropertyPath): string[] {
    return jsonPropertyPath
        .filter((part) => part.type === "objectProperty")
        .map((part) => (part as { type: "objectProperty"; propertyName: string }).propertyName);
}

export interface ObjectPropertyProps {
    property: ApiDefinition.ObjectProperty;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    lang?: string;
    badge?: React.ReactNode;
    /** Parameter location for edit targeting (when rendering endpoint parameters) */
    parameterIn?: "path" | "query" | "header";
}

export const ObjectProperty = React.memo(function ObjectProperty({
    property,
    types,
    location,
    lang = "en",
    badge,
    parameterIn
}: ObjectPropertyProps) {
    const unwrapped = ApiDefinition.unwrapReference(property.valueShape, types);
    const description = compact([property.description, ...unwrapped.descriptions])[0];

    return (
        <PropertyWithShape
            name={property.key}
            availability={property.availability}
            description={description}
            shape={property.valueShape}
            types={types}
            location={location}
            lang={lang}
            badge={badge}
            parameterIn={parameterIn}
        />
    );
});

export interface PropertyWithShapeProps {
    icon?: React.ReactNode;
    name?: string;
    description?: string | undefined;
    /** Ignored - dashboard renders MDX client-side from `description` */
    renderedDescription?: React.ReactNode;
    availability: ApiDefinition.Availability | null | undefined;
    shape: ApiDefinition.TypeShapeOrReference;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang?: string;
    badge?: React.ReactNode;
    /** Parameter location for edit targeting (when rendering endpoint parameters) */
    parameterIn?: "path" | "query" | "header";
}

export const PropertyWithShape = React.memo(function PropertyWithShape({
    icon,
    name,
    description,
    shape,
    availability,
    types,
    location,
    additionalProperties,
    lang = "en",
    badge,
    parameterIn
}: PropertyWithShapeProps) {
    return (
        <PropertyRenderer
            icon={icon}
            name={name}
            description={description}
            typeShorthand={<TypeShorthand shape={shape} lang={lang} />}
            availability={availability}
            badge={badge}
            parameterIn={parameterIn}
        >
            <TypeReferenceDefinitions
                shape={shape}
                types={types}
                location={location}
                additionalProperties={additionalProperties}
                lang={lang}
            />
        </PropertyRenderer>
    );
});

export interface PropertyRendererProps {
    icon?: React.ReactNode;
    name?: string;
    description?: string | undefined;
    /** Ignored - dashboard renders MDX client-side from `description` */
    renderedDescription?: React.ReactNode;
    typeShorthand: React.ReactNode;
    availability: ApiDefinition.Availability | null | undefined;
    children?: React.ReactNode;
    badge?: React.ReactNode;
    /** Parameter location for edit targeting (when rendering endpoint parameters) */
    parameterIn?: "path" | "query" | "header";
}

export const PropertyRenderer = React.memo(function PropertyRenderer({
    icon,
    name,
    availability,
    description,
    typeShorthand,
    children,
    badge,
    parameterIn
}: PropertyRendererProps) {
    const { jsonPropertyPath, isResponse } = useTypeDefinitionContext();

    // Build description edit target from context
    const apiEditTarget = useApiEditTarget();

    const descriptionTarget = useMemo((): DescriptionTarget | null => {
        if (!apiEditTarget) {
            return null;
        }

        const propertyPath = extractPropertyPath(jsonPropertyPath);

        if (apiEditTarget.type === "schema") {
            return {
                type: "property",
                typeId: apiEditTarget.typeId,
                propertyPath
            };
        }

        // WebSocket targets return a websocket target to show edit-disabled indicator
        // with "unsupported-protocol" reason
        if (apiEditTarget.type === "websocket") {
            return {
                type: "websocket",
                path: apiEditTarget.path
            };
        }

        // Webhook targets return a webhook target to show edit-disabled indicator
        // with "unsupported-protocol" reason
        if (apiEditTarget.type === "webhook") {
            return {
                type: "webhook",
                webhookId: apiEditTarget.webhookId
            };
        }

        // gRPC targets return a grpc target to show edit-disabled indicator
        // with "non-openapi-format" reason (proto format not editable)
        if (apiEditTarget.type === "grpc") {
            return {
                type: "grpc",
                methodId: apiEditTarget.methodId
            };
        }

        // For endpoints, check if this is a parameter (path, query, header)
        // Use parameterIn prop if provided (preferred), otherwise try to infer from jsonPropertyPath
        if (apiEditTarget.type === "endpoint") {
            // If parameterIn is explicitly provided, use it directly
            if (parameterIn && name) {
                return {
                    type: "parameter",
                    operationId: apiEditTarget.operationId,
                    method: apiEditTarget.method,
                    path: apiEditTarget.path,
                    paramName: name,
                    paramIn: parameterIn
                };
            }

            // Fallback: try to infer from jsonPropertyPath (for nested properties)
            if (jsonPropertyPath.length >= 1) {
                const firstPart = jsonPropertyPath[0];
                if (firstPart?.type === "objectProperty") {
                    const sectionName = firstPart.propertyName;
                    const paramInMap: { [key: string]: "path" | "query" | "header" | undefined } = {
                        path: "path",
                        query: "query",
                        header: "header"
                    };
                    const inferredParamIn = sectionName ? paramInMap[sectionName] : undefined;

                    if (inferredParamIn && name) {
                        return {
                            type: "parameter",
                            operationId: apiEditTarget.operationId,
                            method: apiEditTarget.method,
                            path: apiEditTarget.path,
                            paramName: name,
                            paramIn: inferredParamIn
                        };
                    }
                }
            }

            // For request/response body properties (not parameters)
            // Use isResponse from context to determine if we're in a response section
            if (propertyPath.length > 0) {
                if (isResponse) {
                    // Response body property - use status code 200 as default
                    // TODO: Pass actual status code through context if multiple responses exist
                    return {
                        type: "responseProperty",
                        operationId: apiEditTarget.operationId,
                        method: apiEditTarget.method,
                        path: apiEditTarget.path,
                        statusCode: 200,
                        propertyPath
                    };
                } else if (isResponse === false) {
                    // Request body property
                    return {
                        type: "requestBodyProperty",
                        operationId: apiEditTarget.operationId,
                        method: apiEditTarget.method,
                        path: apiEditTarget.path,
                        propertyPath
                    };
                }
            }
        }

        return null;
    }, [apiEditTarget, jsonPropertyPath, name, parameterIn, isResponse]);

    const { isEditable, reason } = useDescriptionEditability(descriptionTarget);

    // Get live description that updates when editing in Dev Mode
    const liveDescription = useLiveDescription(descriptionTarget, description);

    const child = (
        <PropertyContainer>
            <TypeDefinitionAnchor sideOffset={6}>
                {icon}
                {badge}
                {name != null && <PropertyKey className="fern-api-property-key">{name}</PropertyKey>}
                {typeShorthand}
                {availability != null && <AvailabilityBadge availability={availability} size="sm" rounded />}
            </TypeDefinitionAnchor>

            {/* Description with edit button (or "Add description" for empty) */}
            {liveDescription ? (
                // Has description: editable gets edit button, non-editable gets mouse-following tooltip
                isEditable && descriptionTarget ? (
                    <div className="group/desc flex items-start gap-1">
                        <MdxContent
                            mdx={liveDescription}
                            size="sm"
                            className="min-w-0 flex-1 text-(color:--grayscale-a11)"
                        />
                        <div className="shrink-0 opacity-0 transition-opacity group-hover/desc:opacity-100">
                            <DescriptionEditButton target={descriptionTarget} currentValue={liveDescription} />
                        </div>
                    </div>
                ) : (
                    <MouseFollowingTooltip reason={reason}>
                        <MdxContent mdx={liveDescription} size="sm" className="text-(color:--grayscale-a11)" />
                    </MouseFollowingTooltip>
                )
            ) : (
                // No description: show "Add description" button on hover (only if editable)
                isEditable &&
                descriptionTarget && (
                    <div className="group/desc opacity-0 transition-opacity hover:opacity-100">
                        <DescriptionEditButton target={descriptionTarget} currentValue="" />
                    </div>
                )
            )}

            <TypeDefinitionCollapsible>{children}</TypeDefinitionCollapsible>
        </PropertyContainer>
    );

    if (name != null) {
        return <TypeDefinitionAnchorPart part={name}>{child}</TypeDefinitionAnchorPart>;
    }

    return child;
});
