import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { TypeDefinitionPathPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { TypeDefinitionSlot } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";
import {
    hasInlineEnum,
    hasInternalTypeReference,
    type PropertyLocation
} from "@fern-docs/components/api-reference/type-definitions/utils";
import React from "react";
import { UnreachableCaseError } from "ts-essentials";

import { InternalTypeDefinition } from "./InternalTypeDefinition";

export { hasInlineEnum, hasInternalTypeReference, type PropertyLocation };

export const TypeReferenceDefinitions = React.memo(function TypeReferenceDefinitions({
    shape,
    types,
    location,
    additionalProperties,
    lang,
    exclude,
    excludeDeprecated,
    isGraphQL = false
}: {
    shape: ApiDefinition.TypeShapeOrReference;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang: string;
    exclude?: string[];
    excludeDeprecated?: boolean;
    isGraphQL?: boolean;
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
                            exclude={exclude}
                            excludeDeprecated={excludeDeprecated}
                            isGraphQL={isGraphQL}
                        />
                    );
                }
            }
            return <TypeDefinitionSlot id={shape.id} location={location} isGraphQL={isGraphQL} />;
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
                    exclude={exclude}
                    excludeDeprecated={excludeDeprecated}
                    isGraphQL={isGraphQL}
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
                        exclude={exclude}
                        excludeDeprecated={excludeDeprecated}
                        isGraphQL={isGraphQL}
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
                        exclude={exclude}
                        excludeDeprecated={excludeDeprecated}
                        isGraphQL={isGraphQL}
                    />
                    <TypeReferenceDefinitions
                        shape={shape.valueShape}
                        types={types}
                        location={location}
                        additionalProperties={additionalProperties}
                        lang={lang}
                        exclude={exclude}
                        excludeDeprecated={excludeDeprecated}
                        isGraphQL={isGraphQL}
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
                    exclude={exclude}
                    excludeDeprecated={excludeDeprecated}
                    isGraphQL={isGraphQL}
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
                    exclude={exclude}
                    excludeDeprecated={excludeDeprecated}
                    isGraphQL={isGraphQL}
                />
            );
        }
        default:
            throw new UnreachableCaseError(shape);
    }
});
