import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { SectionContainer } from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";
import { TypeDefinitionSlotsServer } from "@/components/api-reference/type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "@/components/api-reference/type-definitions/TypeReferenceDefinitions";
import type { TypeDefinitionWithSerializedDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";

type SchemaProps = {
    typeDefinition?: ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions;
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang?: string;
    className?: string;
    exclude?: string[];
    excludeDeprecated?: boolean;
};

export function Schema({ typeDefinition, types, lang, className, exclude, excludeDeprecated }: SchemaProps) {
    const currentSlug = useCurrentSlug();

    if (typeDefinition == null || types == null) {
        return null;
    }

    const schemaName = typeDefinition.displayName || typeDefinition.name || "schema";

    return (
        <TypeDefinitionRoot types={types} slug={currentSlug}>
            <TypeDefinitionSlotsServer types={types} lang={lang ?? "en"}>
                <TypeDefinitionAnchorPart part={schemaName}>
                    <SectionContainer>
                        <div className={className}>
                            <TypeReferenceDefinitions
                                shape={typeDefinition.shape}
                                types={types}
                                lang={lang ?? "en"}
                                exclude={exclude}
                                excludeDeprecated={excludeDeprecated}
                            />
                        </div>
                    </SectionContainer>
                </TypeDefinitionAnchorPart>
            </TypeDefinitionSlotsServer>
        </TypeDefinitionRoot>
    );
}
