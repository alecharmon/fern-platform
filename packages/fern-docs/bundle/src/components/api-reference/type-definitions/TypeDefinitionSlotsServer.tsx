import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { TypeDefinitionSlotsProvider } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";
import { getTypeIdWithLocation } from "@fern-docs/components/api-reference/type-definitions/utils";

import { TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

export function TypeDefinitionSlotsServer({
    types,
    children,
    lang,
    isGraphQL = false
}: {
    types: Record<string, TypeDefinition>;
    children: React.ReactNode;
    lang: string;
    isGraphQL?: boolean;
}) {
    return (
        <TypeDefinitionSlotsProvider slots={createTypeDefinitionSlots(types, lang, isGraphQL)}>
            {children}
        </TypeDefinitionSlotsProvider>
    );
}

function createTypeDefinitionSlots(types: Record<string, TypeDefinition>, lang: string, isGraphQL: boolean) {
    return Object.fromEntries(
        Object.entries(types).flatMap(([id, type]) => {
            const variants = createPropertyAccessTypeVariants(id, type, types, lang, isGraphQL);
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
    lang: string,
    isGraphQL: boolean
) {
    return {
        default: <TypeReferenceDefinitions shape={type.shape} types={types} lang={lang} isGraphQL={isGraphQL} />,
        request: (
            <TypeReferenceDefinitions
                shape={type.shape}
                types={types}
                location="request"
                lang={lang}
                isGraphQL={isGraphQL}
            />
        ),
        response: (
            <TypeReferenceDefinitions
                shape={type.shape}
                types={types}
                location="response"
                lang={lang}
                isGraphQL={isGraphQL}
            />
        )
    };
}
