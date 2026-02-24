import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { SectionContainer } from "@fern-docs/components/api-reference/endpoints/TypeDefinitionAnchor";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionRoot
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { useCurrentSlug } from "@fern-docs/components/hooks/use-current-pathname";
import type React from "react";
import { SerializedMdxRenderer } from "@/components/api-reference/type-definitions/SerializedMdxRenderer";
import { TypeDefinitionSlotsServer } from "@/components/api-reference/type-definitions/TypeDefinitionSlotsServer";
import { TypeReferenceDefinitions } from "@/components/api-reference/type-definitions/TypeReferenceDefinitions";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";
import type { TypeDefinitionWithSerializedDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";

type SchemaProps = {
    /**
     * The name of the API to fetch the type from.
     * If not specified, the type will be fetched from the first API that contains it.
     */
    api?: string;
    typeDefinition?: ApiDefinition.TypeDefinition | TypeDefinitionWithSerializedDescriptions;
    types?: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    lang?: string;
    className?: string;
    include?: string[];
    exclude?: string[];
    excludeDeprecated?: boolean;
    /**
     * If true, includes the type definition's description (e.g. Protobuf message comments).
     */
    description?: boolean;
};

export function Schema({
    typeDefinition,
    types,
    lang,
    className,
    include,
    exclude,
    excludeDeprecated,
    description
}: SchemaProps) {
    const currentSlug = useCurrentSlug();

    if (typeDefinition == null || types == null) {
        return null;
    }

    const schemaName = typeDefinition.displayName || typeDefinition.name || "schema";

    const serializedDescription = (typeDefinition as TypeDefinitionWithSerializedDescriptions).serializedDescription;
    const rawDescription = typeDefinition.description;

    let descriptionContent: React.ReactNode = null;
    if (description) {
        if (serializedDescription) {
            descriptionContent = (
                <SerializedMdxRenderer
                    serializedDescription={serializedDescription}
                    fallback={rawDescription ?? undefined}
                    size="sm"
                    className="text-(color:--grayscale-a11) mb-4"
                />
            );
        } else if (rawDescription) {
            descriptionContent = (
                <MdxServerComponentProseSuspense
                    mdx={rawDescription}
                    size="sm"
                    className="text-(color:--grayscale-a11) mb-4"
                />
            );
        }
    }

    return (
        <TypeDefinitionRoot types={types} slug={currentSlug}>
            <TypeDefinitionSlotsServer types={types} lang={lang ?? "en"}>
                <TypeDefinitionAnchorPart part={schemaName}>
                    <SectionContainer>
                        <div className={className}>
                            {descriptionContent}
                            <TypeReferenceDefinitions
                                shape={typeDefinition.shape}
                                types={types}
                                lang={lang ?? "en"}
                                include={include}
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
