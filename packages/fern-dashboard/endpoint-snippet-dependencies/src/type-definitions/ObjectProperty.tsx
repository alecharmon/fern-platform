import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { AvailabilityBadge } from "@fern-docs/components/badges";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { useCopyToClipboard } from "@fern-ui/react-commons";
import { compact } from "es-toolkit/array";
import { Copy, Info } from "lucide-react";
import React from "react";

import { jsonPropertyPathToString } from "../examples/JsonPropertyPath";
import { PropertyKey } from "./PropertyKey";
import { TypeDefinitionAnchorPart, TypeDefinitionCollapsible, useTypeDefinitionContext } from "./TypeDefinitionContext";
import { type PropertyLocation, TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

export interface ObjectPropertyProps {
    property: ApiDefinition.ObjectProperty;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    TypeShorthand: React.ComponentType<{
        shape: ApiDefinition.TypeShapeOrReference;
    }>;
    PropertyContainer: React.ComponentType<{ children: React.ReactNode }>;
    TypeDefinitionAnchor: React.ComponentType<{
        children: React.ReactNode;
        sideOffset?: number;
    }>;
    MdxRenderer?: React.ComponentType<{
        mdx: string | undefined;
        size?: string;
        className?: string;
    }>;
    Chip: React.ComponentType<{
        name: string;
        description?: React.ReactNode;
    }>;
    ChipSizeProvider: React.ComponentType<{
        children: React.ReactNode;
        size: "sm" | "lg";
    }>;
}

export const ObjectProperty = React.memo(function ObjectProperty({
    property,
    types,
    location,
    TypeShorthand,
    PropertyContainer,
    TypeDefinitionAnchor,
    MdxRenderer,
    Chip,
    ChipSizeProvider
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
            TypeShorthand={TypeShorthand}
            PropertyContainer={PropertyContainer}
            TypeDefinitionAnchor={TypeDefinitionAnchor}
            MdxRenderer={MdxRenderer}
            Chip={Chip}
            ChipSizeProvider={ChipSizeProvider}
        />
    );
});

export interface PropertyWithShapeProps {
    icon?: React.ReactNode;
    name?: string;
    description: string | undefined;
    availability: ApiDefinition.Availability | null | undefined;
    shape: ApiDefinition.TypeShape;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    TypeShorthand: React.ComponentType<{
        shape: ApiDefinition.TypeShapeOrReference;
    }>;
    PropertyContainer: React.ComponentType<{ children: React.ReactNode }>;
    TypeDefinitionAnchor: React.ComponentType<{
        children: React.ReactNode;
        sideOffset?: number;
    }>;
    MdxRenderer?: React.ComponentType<{
        mdx: string | undefined;
        size?: string;
        className?: string;
    }>;
    Chip: React.ComponentType<{
        name: string;
        description?: React.ReactNode;
    }>;
    ChipSizeProvider: React.ComponentType<{
        children: React.ReactNode;
        size: "sm" | "lg";
    }>;
}

export const PropertyWithShape = React.memo(function PropertyWithShape({
    name,
    description,
    shape,
    availability,
    types,
    location,
    additionalProperties,
    TypeShorthand,
    PropertyContainer,
    TypeDefinitionAnchor,
    MdxRenderer,
    Chip,
    ChipSizeProvider
}: PropertyWithShapeProps) {
    return (
        <PropertyRenderer
            name={name}
            description={description}
            typeShorthand={<TypeShorthand shape={shape} />}
            availability={availability}
            PropertyContainer={PropertyContainer}
            TypeDefinitionAnchor={TypeDefinitionAnchor}
            MdxRenderer={MdxRenderer}
        >
            <TypeReferenceDefinitions
                shape={shape}
                types={types}
                location={location}
                additionalProperties={additionalProperties}
                TypeShorthand={TypeShorthand}
                PropertyContainer={PropertyContainer}
                TypeDefinitionAnchor={TypeDefinitionAnchor}
                MdxRenderer={MdxRenderer}
                Chip={Chip}
                ChipSizeProvider={ChipSizeProvider}
            />
        </PropertyRenderer>
    );
});

export interface PropertyRendererProps {
    icon?: React.ReactNode;
    name?: string;
    description: string | undefined;
    typeShorthand: React.ReactNode;
    availability: ApiDefinition.Availability | null | undefined;
    children?: React.ReactNode;
    PropertyContainer: React.ComponentType<{ children: React.ReactNode }>;
    TypeDefinitionAnchor: React.ComponentType<{
        children: React.ReactNode;
        sideOffset?: number;
    }>;
    MdxRenderer?: React.ComponentType<{
        mdx: string | undefined;
        size?: string;
        className?: string;
    }>;
}

export const PropertyRenderer = React.memo(function PropertyRenderer({
    icon,
    name,
    availability,
    description,
    typeShorthand,
    children,
    PropertyContainer,
    TypeDefinitionAnchor,
    MdxRenderer
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

            {MdxRenderer && <MdxRenderer mdx={description} size="sm" className="text-(color:--grayscale-a11)" />}

            <TypeDefinitionCollapsible>{children}</TypeDefinitionCollapsible>
        </PropertyContainer>
    );

    if (name != null) {
        return <TypeDefinitionAnchorPart part={name}>{child}</TypeDefinitionAnchorPart>;
    }

    return child;
});
