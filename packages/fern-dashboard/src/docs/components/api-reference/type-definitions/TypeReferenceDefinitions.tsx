"use client";

/**
 * Dashboard-specific TypeReferenceDefinitions (client-side MDX).
 *
 * Forms a closed recursive loop with other local type definition components
 * (ObjectProperty, InternalTypeDefinition, etc.) to ensure all nested types
 * render descriptions client-side via MdxContent.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/type-definitions/TypeReferenceDefinitions.tsx
 */

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { TypeDefinitionPathPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import {
    type PropertyLocation,
    TypeDefinitionSlot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";
import React from "react";

import { InternalTypeDefinition } from "./InternalTypeDefinition";

export type { PropertyLocation };

// HACHACK: this is a hack to render inlined enums above the description
export function hasInlineEnum(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): boolean {
    const unwrapped = ApiDefinition.unwrapReference(shape, types);
    return visitDiscriminatedUnion(unwrapped.shape)._visit<boolean>({
        object: () => false,
        enum: (value) => value.values.length < 6,
        undiscriminatedUnion: () => false,
        discriminatedUnion: () => false,
        list: (value) => hasInlineEnum(value.itemShape, types),
        set: (value) => hasInlineEnum(value.itemShape, types),
        map: (map) => hasInlineEnum(map.keyShape, types) || hasInlineEnum(map.valueShape, types),
        primitive: () => false,
        literal: () => true,
        unknown: () => false,
        _other: () => false
    });
}

export function hasInternalTypeReference(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): boolean {
    const unwrapped = ApiDefinition.unwrapReference(shape, types);
    return visitDiscriminatedUnion(unwrapped.shape)._visit<boolean>({
        object: () => true,
        enum: () => true,
        undiscriminatedUnion: () => true,
        discriminatedUnion: () => true,
        list: () => true,
        set: () => true,
        map: (map) => hasInternalTypeReference(map.keyShape, types) || hasInternalTypeReference(map.valueShape, types),
        primitive: () => false,
        literal: () => true,
        unknown: () => false,
        _other: () => false
    });
}

export const TypeReferenceDefinitions = React.memo(function TypeReferenceDefinitions({
    shape,
    types,
    location,
    additionalProperties,
    lang = "en"
}: {
    shape: ApiDefinition.TypeShapeOrReference;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang?: string;
}) {
    switch (shape.type) {
        case "id":
            if (additionalProperties) {
                const newTypeShape = types[shape.id]?.shape;
                if (newTypeShape && newTypeShape.type === "object") {
                    const updatedShape = {
                        ...newTypeShape,
                        properties: [...(additionalProperties ?? []), ...(newTypeShape.properties ?? [])]
                    };
                    return (
                        <TypeReferenceDefinitions shape={updatedShape} types={types} location={location} lang={lang} />
                    );
                }
            }
            return <TypeDefinitionSlot id={shape.id} location={location} />;
        case "object":
        case "enum":
        case "primitive":
        case "undiscriminatedUnion":
        case "discriminatedUnion":
            return (
                <InternalTypeDefinition
                    shape={shape}
                    types={types}
                    location={location}
                    additionalProperties={additionalProperties}
                    lang={lang}
                />
            );
        case "list":
        case "set":
            return (
                <TypeDefinitionPathPart part={{ type: "listItem" }}>
                    <TypeReferenceDefinitions
                        shape={shape.itemShape}
                        types={types}
                        location={location}
                        additionalProperties={additionalProperties}
                        lang={lang}
                    />
                </TypeDefinitionPathPart>
            );
        case "map":
            return (
                <TypeDefinitionPathPart part={{ type: "objectProperty" }}>
                    <TypeReferenceDefinitions
                        shape={shape.keyShape}
                        types={types}
                        location={location}
                        additionalProperties={additionalProperties}
                        lang={lang}
                    />
                    <TypeReferenceDefinitions
                        shape={shape.valueShape}
                        types={types}
                        location={location}
                        additionalProperties={additionalProperties}
                        lang={lang}
                    />
                </TypeDefinitionPathPart>
            );
        case "literal":
        case "unknown":
            return null;
        case "alias": {
            return (
                <TypeReferenceDefinitions
                    shape={shape.value}
                    types={types}
                    location={location}
                    additionalProperties={additionalProperties}
                    lang={lang}
                />
            );
        }
        case "optional":
        case "nullable": {
            return (
                <TypeReferenceDefinitions
                    shape={shape.shape}
                    types={types}
                    location={location}
                    additionalProperties={additionalProperties}
                    lang={lang}
                />
            );
        }
        default: {
            const _exhaustiveCheck: never = shape;
            throw new Error(`Unhandled case: ${(_exhaustiveCheck as { type: string }).type}`);
        }
    }
});
