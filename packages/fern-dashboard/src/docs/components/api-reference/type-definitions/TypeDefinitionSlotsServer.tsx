"use client";

import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { TypeDefinitionSlotsProvider } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";
import { getTypeIdWithLocation } from "@fern-docs/components/api-reference/type-definitions/utils";
import { TypeDefinitionRequest, TypeDefinitionResponse } from "./TypeDefinitionContext";

import { TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

// Re-export for convenience
export { getTypeIdWithLocation };

/**
 * Dashboard-specific wrapper for TypeDefinitionSlotsServer that provides
 * pre-rendered type definition slots for each type in the types map.
 */
export function TypeDefinitionSlotsServer({
    types,
    children,
    lang = "en"
}: {
    types: Record<string, TypeDefinition>;
    children: React.ReactNode;
    lang?: string;
}) {
    return (
        <TypeDefinitionSlotsProvider slots={createTypeDefinitionSlots(types, lang)}>
            {children}
        </TypeDefinitionSlotsProvider>
    );
}

function createTypeDefinitionSlots(types: Record<string, TypeDefinition>, lang: string) {
    return Object.fromEntries(
        Object.entries(types).flatMap(([id, type]) => {
            const variants = createPropertyAccessTypeVariants(id, type, types, lang);
            return [
                [id, variants.default],
                [getTypeIdWithLocation(id, "request"), variants.request],
                [getTypeIdWithLocation(id, "response"), variants.response]
            ];
        })
    );
}

function createPropertyAccessTypeVariants(
    id: string,
    type: TypeDefinition,
    types: Record<string, TypeDefinition>,
    lang: string
) {
    return {
        default: <TypeReferenceDefinitions shape={type.shape} types={types} lang={lang} />,
        request: (
            <TypeDefinitionRequest>
                <TypeReferenceDefinitions shape={type.shape} types={types} location="request" lang={lang} />
            </TypeDefinitionRequest>
        ),
        response: (
            <TypeDefinitionResponse>
                <TypeReferenceDefinitions shape={type.shape} types={types} location="response" lang={lang} />
            </TypeDefinitionResponse>
        )
    };
}
