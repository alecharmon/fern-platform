import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { memo } from "react";
import { UnreachableCaseError } from "ts-essentials";

import { DiscriminatedUnionVariant } from "./DiscriminatedUnionVariant";
import { EnumTypeDefinition } from "./EnumTypeDefinition";
import { EnumValue } from "./EnumValue";
import { FernCollapseWithButtonUncontrolled } from "./FernCollapseWithButtonUncontrolled";
import { ObjectProperty } from "./ObjectProperty";
import { TypeDefinitionPathPart } from "./TypeDefinitionContext";
import { WithSeparator } from "./TypeDefinitionDetails";
import type { PropertyLocation } from "./TypeReferenceDefinitions";
import { UndiscriminatedUnionVariant } from "./UndiscriminatedUnionVariant";

export declare namespace InternalTypeDefinition {
    export interface Props {
        shape: ApiDefinition.TypeShapeOrReference;
        types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
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
}

export const InternalTypeDefinition = memo(function InternalTypeDefinition({
    shape,
    types,
    location,
    additionalProperties,
    TypeShorthand,
    PropertyContainer,
    TypeDefinitionAnchor,
    MdxRenderer,
    Chip,
    ChipSizeProvider
}: {
    shape:
        | ApiDefinition.TypeShape.Enum
        | ApiDefinition.TypeShape.UndiscriminatedUnion
        | ApiDefinition.TypeShape.DiscriminatedUnion
        | ApiDefinition.TypeShape.Object_
        | ApiDefinition.TypeReference.Primitive;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
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
}) {
    switch (shape.type) {
        case "enum": {
            return (
                <EnumTypeDefinition
                    elements={shape.values.map((value) => ({
                        element: (
                            <EnumValue key={value.value} enumValue={value} Chip={Chip} MdxRenderer={MdxRenderer} />
                        ),
                        searchableString: `${value.value} ${value.description ?? ""}`
                    }))}
                    ChipSizeProvider={ChipSizeProvider}
                />
            );
        }
        case "undiscriminatedUnion":
            return (
                <FernCollapseWithButtonUncontrolled
                    showText={`Show ${shape.variants.length} variants`}
                    hideText={`Hide ${shape.variants.length} variants`}
                >
                    <WithSeparator separatorText="OR">
                        {shape.variants.map((variant, idx) => (
                            <UndiscriminatedUnionVariant
                                key={variant.displayName}
                                unionVariant={variant}
                                idx={idx}
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
                        ))}
                    </WithSeparator>
                </FernCollapseWithButtonUncontrolled>
            );
        case "discriminatedUnion":
            return (
                <FernCollapseWithButtonUncontrolled
                    showText={`Show ${shape.variants.length} variants`}
                    hideText={`Hide ${shape.variants.length} variants`}
                >
                    <WithSeparator separatorText="OR">
                        {shape.variants.map((variant) => (
                            <DiscriminatedUnionVariant
                                discriminant={shape.discriminant}
                                key={variant.displayName}
                                unionVariant={variant}
                                types={types}
                                location={location}
                                TypeShorthand={TypeShorthand}
                                PropertyContainer={PropertyContainer}
                                TypeDefinitionAnchor={TypeDefinitionAnchor}
                                MdxRenderer={MdxRenderer}
                                Chip={Chip}
                                ChipSizeProvider={ChipSizeProvider}
                            />
                        ))}
                    </WithSeparator>
                </FernCollapseWithButtonUncontrolled>
            );
        case "object": {
            const properties = ApiDefinition.unwrapObjectType(shape, types).properties;

            const filteredProperties = filterDuplicateObjectProperties(
                filterObjectPropertiesByAccess(properties, location)
            );

            if (filteredProperties.length === 0) {
                return null;
            }

            return (
                <FernCollapseWithButtonUncontrolled
                    showText={`Show ${filteredProperties.length + (additionalProperties?.length ?? 0)} properties`}
                    hideText={`Hide ${filteredProperties.length + (additionalProperties?.length ?? 0)} properties`}
                >
                    <WithSeparator>
                        {additionalProperties?.map((property) => (
                            <TypeDefinitionPathPart
                                key={property.key}
                                part={{ type: "objectProperty", propertyName: property.key }}
                            >
                                <ObjectProperty
                                    property={property}
                                    types={types}
                                    location={location}
                                    TypeShorthand={TypeShorthand}
                                    PropertyContainer={PropertyContainer}
                                    TypeDefinitionAnchor={TypeDefinitionAnchor}
                                    MdxRenderer={MdxRenderer}
                                    Chip={Chip}
                                    ChipSizeProvider={ChipSizeProvider}
                                />
                            </TypeDefinitionPathPart>
                        ))}
                        {filteredProperties.map((property) => (
                            <TypeDefinitionPathPart
                                key={property.key}
                                part={{ type: "objectProperty", propertyName: property.key }}
                            >
                                <ObjectProperty
                                    property={property}
                                    types={types}
                                    location={location}
                                    TypeShorthand={TypeShorthand}
                                    PropertyContainer={PropertyContainer}
                                    TypeDefinitionAnchor={TypeDefinitionAnchor}
                                    MdxRenderer={MdxRenderer}
                                    Chip={Chip}
                                    ChipSizeProvider={ChipSizeProvider}
                                />
                            </TypeDefinitionPathPart>
                        ))}
                    </WithSeparator>
                </FernCollapseWithButtonUncontrolled>
            );
        }
        case "primitive":
            return null;
        default:
            throw new UnreachableCaseError(shape);
    }
});

const filterObjectPropertiesByAccess = (
    properties: ApiDefinition.ObjectProperty[],
    location: PropertyLocation | undefined
) => {
    if (location === undefined) {
        return properties;
    }

    return properties.filter((property) => {
        if (location === "request") {
            return property.propertyAccess !== "READ_ONLY";
        } else if (location === "response") {
            return property.propertyAccess !== "WRITE_ONLY";
        }
        return true;
    });
};

const filterDuplicateObjectProperties = (properties: ApiDefinition.ObjectProperty[]) => {
    return properties.reduce<ApiDefinition.ObjectProperty[]>((acc, property) => {
        if (!acc.some((p) => p.key === property.key)) {
            acc.push(property);
        }
        return acc;
    }, []);
};
