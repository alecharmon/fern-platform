import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import {
    getIconInfoForTypeReference,
    type PropertyLocation
} from "@fern-docs/components/api-reference/type-definitions/utils";
import type { ReactElement } from "react";

import type { UndiscriminatedUnionVariantWithSerializedDescription } from "@/mdx/plugins/serialize-type-definition-descriptions";
import { PropertyWithShape } from "./ObjectProperty";

function getIconForTypeReference(
    typeRef: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): ReactElement<any> | null {
    const info = getIconInfoForTypeReference(typeRef, types);
    if (info == null) {
        return null;
    }
    const { content, size } = info;
    return (
        <div
            className="border-border-default rounded-1 flex size-6 items-center justify-center self-center border"
            style={{ fontSize: size }}
        >
            {content}
        </div>
    );
}

export declare namespace UndiscriminatedUnionVariant {
    export interface Props {
        unionVariant: ApiDefinition.UndiscriminatedUnionVariant;
        anchorIdParts: readonly string[];
        slug: FernNavigation.Slug;
        idx: number;
        types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    }
}

export function UndiscriminatedUnionVariant({
    unionVariant,
    types,
    location,
    additionalProperties,
    lang
}: {
    unionVariant: ApiDefinition.UndiscriminatedUnionVariant | UndiscriminatedUnionVariantWithSerializedDescription;
    idx: number;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang: string;
}) {
    const serializedDescription = (unionVariant as UndiscriminatedUnionVariantWithSerializedDescription)
        .serializedDescription;

    return (
        <PropertyWithShape
            icon={getIconForTypeReference(unionVariant.shape, types)}
            name={unionVariant.displayName}
            availability={unionVariant.availability}
            description={unionVariant.description}
            serializedDescription={serializedDescription}
            shape={unionVariant.shape}
            types={types}
            location={location}
            additionalProperties={additionalProperties}
            lang={lang}
        />
    );
}
