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

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { TypeDefinitionPathPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { TypeDefinitionSlot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";
import {
    hasInlineEnum,
    hasInternalTypeReference,
    type PropertyLocation
} from "@fern-docs/components/api-reference/type-definitions/utils";
import React from "react";

import { InternalTypeDefinition } from "./InternalTypeDefinition";

export { hasInlineEnum, hasInternalTypeReference, type PropertyLocation };

export const TypeReferenceDefinitions = React.memo(function TypeReferenceDefinitions({
    shape,
    types,
    location,
    additionalProperties,
    lang = "en",
    include,
    exclude,
    excludeDeprecated
}: {
    shape: ApiDefinition.TypeShapeOrReference;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang?: string;
    /** @todo Handle for API compatibility with bundle's TypeReferenceDefinitions */
    include?: string[];
    /** @todo Handle for API compatibility with bundle's TypeReferenceDefinitions */
    exclude?: string[];
    /** @todo Handle for API compatibility with bundle's TypeReferenceDefinitions */
    excludeDeprecated?: boolean;
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
                        <TypeReferenceDefinitions
                            shape={updatedShape}
                            types={types}
                            location={location}
                            lang={lang}
                            include={include}
                            exclude={exclude}
                            excludeDeprecated={excludeDeprecated}
                        />
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
                    include={include}
                    exclude={exclude}
                    excludeDeprecated={excludeDeprecated}
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
                        include={include}
                        exclude={exclude}
                        excludeDeprecated={excludeDeprecated}
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
                        include={include}
                        exclude={exclude}
                        excludeDeprecated={excludeDeprecated}
                    />
                    <TypeReferenceDefinitions
                        shape={shape.valueShape}
                        types={types}
                        location={location}
                        additionalProperties={additionalProperties}
                        lang={lang}
                        include={include}
                        exclude={exclude}
                        excludeDeprecated={excludeDeprecated}
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
                    include={include}
                    exclude={exclude}
                    excludeDeprecated={excludeDeprecated}
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
                    include={include}
                    exclude={exclude}
                    excludeDeprecated={excludeDeprecated}
                />
            );
        }
        default: {
            const _exhaustiveCheck: never = shape;
            throw new Error(`Unhandled case: ${(_exhaustiveCheck as { type: string }).type}`);
        }
    }
});
