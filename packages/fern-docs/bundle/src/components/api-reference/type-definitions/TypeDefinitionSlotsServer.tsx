// import "server-only";
import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";

import { TypeDefinitionSlotsProvider } from "./TypeDefinitionSlotsClient";
import { type PropertyLocation, TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

export function TypeDefinitionSlotsServer({
    types,
    children
}: {
    types: Record<string, TypeDefinition>;
    children: React.ReactNode;
}) {
    return (
        <TypeDefinitionSlotsProvider slots={createTypeDefinitionSlots(types)}>{children}</TypeDefinitionSlotsProvider>
    );
}

function createTypeDefinitionSlots(types: Record<string, TypeDefinition>) {
    return Object.fromEntries(
        Object.entries(types).flatMap(([id, type]) => {
            const variants = createPropertyAccessTypeVariants(id, type, types);
            return [
                [id, variants.default],
                [getTypeIdWithLocation(id, "request"), variants.request],
                [getTypeIdWithLocation(id, "response"), variants.response]
            ];
        })
    );
}

function createPropertyAccessTypeVariants(id: string, type: TypeDefinition, types: Record<string, TypeDefinition>) {
    return {
        default: <TypeReferenceDefinitions shape={type.shape} types={types} />,
        request: <TypeReferenceDefinitions shape={type.shape} types={types} location="request" />,
        response: <TypeReferenceDefinitions shape={type.shape} types={types} location="response" />
    };
}

export function getTypeIdWithLocation(id: string, location: PropertyLocation) {
    return `${id}_location:${location}`;
}
