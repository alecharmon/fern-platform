"use client";

/**
 * Dashboard-specific EndpointError (client-side MDX).
 *
 * Renders individual error responses with description and type shape.
 * Uses dashboard's local type definition components for client-side MDX rendering.
 *
 * @see packages/fern-docs/bundle/src/components/api-reference/endpoints/EndpointError.tsx
 */

import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type { APIV1Read } from "@fern-api/fdr-sdk/client/types";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import { TypeDefinitionAnchorPart } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { Badge } from "@fern-docs/components/badges";
import { Separator } from "@fern-docs/components/Separator";
import { renderTypeShorthand } from "@fern-docs/components/type-shorthand";

import { MdxContent } from "@/docs/mdx/components/MdxContent";

import { ObjectProperty } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

const HEADER_BADGE = (
    <Badge size="sm" rounded>
        Header
    </Badge>
);

export function EndpointError({
    error,
    types,
    lang
}: {
    error: ApiDefinition.ErrorResponse;
    availability: APIV1Read.Availability | null | undefined;
    types: Record<string, ApiDefinition.TypeDefinition>;
    lang: string;
}) {
    const hasHeaders = error.headers != null && error.headers.length > 0;
    const hasShape = error.shape != null && !shouldHideShape(error.shape, types);

    if (!hasHeaders && error.shape == null) {
        return null;
    }

    return (
        <div className="-mb-2 space-y-2 pt-2 text-left">
            <MdxContent
                mdx={error.description}
                fallback={
                    error.shape != null
                        ? `This error returns ${renderTypeShorthand(error.shape, { withArticle: true }, types)}.`
                        : undefined
                }
                size="sm"
                className="text-(color:--grayscale-a11)"
            />
            {(hasHeaders || hasShape) && <Separator />}
            <WithSeparator>
                {error.headers?.map((header) => (
                    <TypeDefinitionAnchorPart key={header.key} part={header.key}>
                        <ObjectProperty property={header} types={types} lang={lang} badge={HEADER_BADGE} />
                    </TypeDefinitionAnchorPart>
                ))}
            </WithSeparator>
            {hasShape && error.shape != null && (
                <TypeReferenceDefinitions shape={error.shape} types={types} lang={lang} />
            )}
        </div>
    );
}

function shouldHideShape(
    shape: ApiDefinition.TypeShapeOrReference,
    types: Record<string, ApiDefinition.TypeDefinition>
): boolean {
    return visitDiscriminatedUnion(ApiDefinition.unwrapReference(shape, types).shape)._visit<boolean>({
        primitive: () => true,
        literal: () => true,
        object: (object) => ApiDefinition.unwrapObjectType(object, types).properties.length === 0,
        undiscriminatedUnion: () => false,
        discriminatedUnion: () => false,
        enum: () => false,
        list: (value) => shouldHideShape(value.itemShape, types),
        set: (value) => shouldHideShape(value.itemShape, types),
        map: () => false,
        unknown: () => true,
        _other: () => true
    });
}
