"use client";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import {
    getIconInfoForTypeReference,
    type PropertyLocation
} from "@fern-docs/components/api-reference/type-definitions/utils";
import type { ReactElement } from "react";

import { PropertyWithShape } from "./ObjectProperty";

function getIconForTypeReference(
    typeRef: ApiDefinition.TypeShapeOrReference,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): ReactElement<unknown> | null {
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

export function UndiscriminatedUnionVariant({
    unionVariant,
    types,
    location,
    additionalProperties,
    lang = "en"
}: {
    unionVariant: ApiDefinition.UndiscriminatedUnionVariant;
    idx: number;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    location?: PropertyLocation;
    additionalProperties?: ApiDefinition.ObjectProperty[];
    lang?: string;
}) {
    return (
        <PropertyWithShape
            icon={getIconForTypeReference(unionVariant.shape, types)}
            name={unionVariant.displayName}
            availability={unionVariant.availability}
            description={unionVariant.description}
            shape={unionVariant.shape}
            types={types}
            location={location}
            additionalProperties={additionalProperties}
            lang={lang}
        />
    );
}
