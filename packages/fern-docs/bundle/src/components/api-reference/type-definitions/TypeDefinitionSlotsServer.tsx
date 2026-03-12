import type { TypeDefinition } from "@fern-api/fdr-sdk/api-definition";
import { TypeDefinitionSlotsProvider } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionSlotsClient";
import { getTypeIdWithLocation } from "@fern-docs/components/api-reference/type-definitions/utils";
import type { TypeDefinitionWithSerializedDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";
import { getRemoteMDXRenderingConfig } from "@/server/remote-renderer/feature-flags";

import { TypeReferenceDefinitions } from "./TypeReferenceDefinitions";

export function TypeDefinitionSlotsServer({
    types,
    children,
    lang,
    showUnionsAsDropdown = false,
    isGraphQL = false
}: {
    types: Record<string, TypeDefinition | TypeDefinitionWithSerializedDescriptions>;
    children: React.ReactNode;
    lang: string;
    showUnionsAsDropdown?: boolean;
    isGraphQL?: boolean;
}) {
    const { enabled: useRemoteRendering } = getRemoteMDXRenderingConfig();

    const slots = useRemoteRendering
        ? createDataSlots(types, lang, showUnionsAsDropdown, isGraphQL)
        : createTypeDefinitionSlots(types, lang, showUnionsAsDropdown, isGraphQL);

    return <TypeDefinitionSlotsProvider slots={slots}>{children}</TypeDefinitionSlotsProvider>;
}

/**
 * Creates data-based slots (lazy rendering approach).
 * Stores shape + metadata instead of pre-rendered JSX.
 * TypeDefinitionSlot will render on-demand when expanded.
 */
function createDataSlots(
    types: Record<string, TypeDefinition | TypeDefinitionWithSerializedDescriptions>,
    lang: string,
    showUnionsAsDropdown: boolean,
    isGraphQL: boolean
) {
    return Object.fromEntries(
        Object.entries(types).flatMap(([id, type]) => [
            [
                id,
                {
                    shape: type.shape,
                    types,
                    lang,
                    showUnionsAsDropdown,
                    isGraphQL
                }
            ],
            [
                getTypeIdWithLocation(id, "request"),
                {
                    shape: type.shape,
                    types,
                    lang,
                    location: "request" as const,
                    showUnionsAsDropdown,
                    isGraphQL
                }
            ],
            [
                getTypeIdWithLocation(id, "response"),
                {
                    shape: type.shape,
                    types,
                    lang,
                    location: "response" as const,
                    showUnionsAsDropdown,
                    isGraphQL
                }
            ]
        ])
    );
}

function createTypeDefinitionSlots(
    types: Record<string, TypeDefinition>,
    lang: string,
    showUnionsAsDropdown: boolean,
    isGraphQL: boolean
) {
    return Object.fromEntries(
        Object.entries(types).flatMap(([id, type]) => {
            const variants = createPropertyAccessTypeVariants(id, type, types, lang, showUnionsAsDropdown, isGraphQL);
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
    showUnionsAsDropdown: boolean,
    isGraphQL: boolean
) {
    return {
        default: (
            <TypeReferenceDefinitions
                shape={type.shape}
                types={types}
                lang={lang}
                showUnionsAsDropdown={showUnionsAsDropdown}
                isGraphQL={isGraphQL}
            />
        ),
        request: (
            <TypeReferenceDefinitions
                shape={type.shape}
                types={types}
                location="request"
                lang={lang}
                showUnionsAsDropdown={showUnionsAsDropdown}
                isGraphQL={isGraphQL}
            />
        ),
        response: (
            <TypeReferenceDefinitions
                shape={type.shape}
                types={types}
                location="response"
                lang={lang}
                showUnionsAsDropdown={showUnionsAsDropdown}
                isGraphQL={isGraphQL}
            />
        )
    };
}
