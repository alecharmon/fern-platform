"use client";

/**
 * Dashboard-specific ObjectProperty (client-side MDX).
 *
 * Props mirror @fern-docs/bundle ObjectProperty for interface compatibility with shared
 * components. Uses local TypeReferenceDefinitions to form a closed recursive loop where
 * all nested types render descriptions client-side via MdxContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/type-definitions/ObjectProperty.tsx
 */
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import {
    PropertyContainer,
    TypeDefinitionAnchor
} from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import { jsonPropertyPathToString } from "@fern-docs/components/api-reference/examples/JsonPropertyPath";
import { PropertyKey } from "@fern-docs/components/api-reference/type-definitions/PropertyKey";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionCollapsible,
    useTypeDefinitionContext
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useCopyToClipboard } from "@fern-ui/react-commons";
import { compact } from "es-toolkit/array";
import { Copy, Info } from "lucide-react";
import React from "react";

import { MdxContent } from "@/docs/mdx/components/MdxContent";
import { type PropertyLocation, TypeReferenceDefinitions } from "./TypeReferenceDefinitions";
import { TypeShorthand } from "./TypeShorthand";

export interface ObjectPropertyProps {
    property: ApiDefinition.ObjectProperty;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    lang?: string;
}

export const ObjectProperty = React.memo(function ObjectProperty({
    property,
    types,
    location,
    lang = "en"
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
    shape: ApiDefinition.TypeShape;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang?: string;
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
    lang = "en"
}: PropertyWithShapeProps) {
    return (
        <PropertyRenderer
            icon={icon}
            name={name}
            description={description}
            typeShorthand={<TypeShorthand shape={shape} lang={lang} />}
            availability={availability}
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
}

export const PropertyRenderer = React.memo(function PropertyRenderer({
    icon,
    name,
    availability,
    description,
    typeShorthand,
    children
}: PropertyRendererProps) {
    const { jsonPropertyPath } = useTypeDefinitionContext();
    const fullPath = jsonPropertyPathToString(jsonPropertyPath);
    const showTooltip = jsonPropertyPath.length > 1;

    const { copyToClipboard } = useCopyToClipboard(fullPath);

    const child = (
        <PropertyContainer>
            <TypeDefinitionAnchor sideOffset={6}>
                {icon}
                {name != null && <PropertyKey className="fern-api-property-key">{name}</PropertyKey>}
                {showTooltip && (
                    <FernTooltipProvider delayDuration={0}>
                        <FernTooltip
                            content={
                                <div className="flex items-center gap-2">
                                    <span className="break-all text-left">{fullPath}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void copyToClipboard?.();
                                        }}
                                        className="hover:text-(color:--accent-a11) text-(color:--grayscale-a11) shrink-0 transition-colors"
                                        aria-label="Copy property path"
                                    >
                                        <Copy className="size-3.5" />
                                    </button>
                                </div>
                            }
                            side="right"
                            sideOffset={6}
                        >
                            <button
                                className="text-(color:--grayscale-a9) hover:text-(color:--grayscale-a11) ml-1 inline-flex items-center transition-colors"
                                aria-label="Show property path"
                            >
                                <Info className="size-3.5" />
                            </button>
                        </FernTooltip>
                    </FernTooltipProvider>
                )}
                {typeShorthand}
                {availability != null && <AvailabilityBadge availability={availability} size="sm" rounded />}
            </TypeDefinitionAnchor>

            {description && <MdxContent mdx={description} size="sm" className="text-(color:--grayscale-a11)" />}

            <TypeDefinitionCollapsible>{children}</TypeDefinitionCollapsible>
        </PropertyContainer>
    );

    if (name != null) {
        return <TypeDefinitionAnchorPart part={name}>{child}</TypeDefinitionAnchorPart>;
    }

    return child;
});
