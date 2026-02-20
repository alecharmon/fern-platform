"use client";

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { EnumTypeDefinition } from "@fern-docs/components/api-reference/type-definitions/EnumTypeDefinition";
import { FernCollapseWithButtonUncontrolled } from "@fern-docs/components/api-reference/type-definitions/FernCollapseWithButtonUncontrolled";
import { TypeDefinitionPathPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import {
    filterDuplicateObjectProperties,
    filterObjectPropertiesByAccess,
    filterObjectPropertiesBySelection,
    type PropertyLocation
} from "@fern-docs/components/api-reference/type-definitions/utils";
import { memo } from "react";

import { DiscriminatedUnionVariantSelector } from "./DiscriminatedUnionVariantSelector";
import { EnumValue } from "./EnumValue";
import { ObjectProperty } from "./ObjectProperty";
import { UndiscriminatedUnionVariantSelector } from "./UndiscriminatedUnionVariantSelector";

export const InternalTypeDefinition = memo(function InternalTypeDefinition({
    shape,
    types,
    location,
    additionalProperties,
    lang = "en",
    include,
    exclude,
    excludeDeprecated
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
    lang?: string;
    /** @todo Handle for API compatibility with bundle's InternalTypeDefinition */
    include?: string[];
    /** @todo Handle for API compatibility with bundle's InternalTypeDefinition */
    exclude?: string[];
    /** @todo Handle for API compatibility with bundle's InternalTypeDefinition */
    excludeDeprecated?: boolean;
}) {
    switch (shape.type) {
        case "enum": {
            return (
                <EnumTypeDefinition
                    elements={shape.values.map((value) => ({
                        element: <EnumValue key={value.value} enumValue={value} lang={lang} />,
                        searchableString: `${value.value} ${value.description ?? ""}`
                    }))}
                    lang={lang}
                />
            );
        }
        case "undiscriminatedUnion":
            return (
                <UndiscriminatedUnionVariantSelector
                    variants={shape.variants}
                    types={types}
                    location={location}
                    additionalProperties={additionalProperties}
                    lang={lang}
                />
            );
        case "discriminatedUnion":
            return (
                <DiscriminatedUnionVariantSelector
                    discriminant={shape.discriminant}
                    variants={shape.variants}
                    types={types}
                    location={location}
                    lang={lang}
                />
            );
        case "object": {
            const properties = ApiDefinition.unwrapObjectType(shape, types).properties;

            const filteredProperties = filterDuplicateObjectProperties(
                filterObjectPropertiesBySelection(filterObjectPropertiesByAccess(properties, location), {
                    include,
                    exclude,
                    excludeDeprecated
                })
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
                                <ObjectProperty property={property} types={types} location={location} lang={lang} />
                            </TypeDefinitionPathPart>
                        ))}
                        {filteredProperties.map((property) => (
                            <TypeDefinitionPathPart
                                key={property.key}
                                part={{ type: "objectProperty", propertyName: property.key }}
                            >
                                <ObjectProperty property={property} types={types} location={location} lang={lang} />
                            </TypeDefinitionPathPart>
                        ))}
                    </WithSeparator>
                </FernCollapseWithButtonUncontrolled>
            );
        }
        case "primitive":
            return null;
        default: {
            const _exhaustiveCheck: never = shape;
            throw new Error(`Unhandled case: ${(_exhaustiveCheck as { type: string }).type}`);
        }
    }
});
