import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";

import { TypeDefinitionRoot } from "@/components/api-reference/type-definitions/TypeDefinitionContext";
import { TypeDefinitionSlotsServer } from "@/components/api-reference/type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "@/components/api-reference/type-definitions/TypeReferenceDefinitions";

type SchemaProps = {
    typeDefinition?: ApiDefinition.TypeDefinition;
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang?: string;
    className?: string;
};

export function Schema({ typeDefinition, types, lang, className }: SchemaProps) {
    const currentSlug = useCurrentSlug();

    if (typeDefinition == null || types == null) {
        return null;
    }

    return (
        <TypeDefinitionRoot types={types} slug={currentSlug}>
            <TypeDefinitionSlotsServer types={types} lang={lang ?? "en"}>
                <div className={className}>
                    <TypeReferenceDefinitions shape={typeDefinition.shape} types={types} lang={lang ?? "en"} />
                </div>
            </TypeDefinitionSlotsServer>
        </TypeDefinitionRoot>
    );
}
