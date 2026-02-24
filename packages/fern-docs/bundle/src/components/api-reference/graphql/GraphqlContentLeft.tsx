import "server-only";

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import type { GraphqlContext, TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";
import { unwrapReference } from "@fern-api/fdr-sdk/api-definition";
import { GraphqlSection } from "@fern-docs/components/api-reference/graphql/GraphqlSection";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionResponse
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { renderTypeShorthand } from "@fern-docs/components/type-shorthand";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

/**
 * Determines if the return type has expandable fields (object, enum, union).
 * Primitives, literals, and unknown types don't have nested fields to expand.
 */
function hasExpandableFields(
    shape: TypeShapeOrReference,
    types: Record<string, ApiDefinition.TypeDefinition>
): boolean {
    const unwrapped = unwrapReference(shape, types);
    switch (unwrapped.shape.type) {
        case "object":
        case "enum":
        case "undiscriminatedUnion":
        case "discriminatedUnion":
            return true;
        case "list":
        case "set":
            return hasExpandableFields(unwrapped.shape.itemShape, types);
        case "map":
            return (
                hasExpandableFields(unwrapped.shape.keyShape, types) ||
                hasExpandableFields(unwrapped.shape.valueShape, types)
            );
        case "primitive":
        case "literal":
        case "unknown":
            return false;
        default:
            return false;
    }
}

export interface HoveringProps {
    isHovering: boolean;
}

export async function GraphqlContentLeft({
    context: { operation, types },
    lang
}: {
    context: GraphqlContext;
    lang: string;
}) {
    return (
        <>
            <TypeDefinitionAnchorPart part="arguments">
                {operation.arguments != null && operation.arguments.length > 0 && (
                    <GraphqlSection
                        title="Arguments"
                        description={
                            <MdxServerComponentProseSuspense
                                size="sm"
                                className="text-(color:--grayscale-a11)"
                                mdx={undefined}
                            />
                        }
                    >
                        <TypeDefinitionAnchorPart part="body">
                            <WithSeparator>
                                {operation.arguments.map((arg) => (
                                    <PropertyWithShape
                                        key={arg.name}
                                        name={arg.name}
                                        shape={arg.type}
                                        description={arg.description ?? undefined}
                                        availability={arg.availability}
                                        types={types}
                                        lang={lang}
                                        isGraphQL
                                    />
                                ))}
                            </WithSeparator>
                        </TypeDefinitionAnchorPart>
                    </GraphqlSection>
                )}
            </TypeDefinitionAnchorPart>
            <TypeDefinitionResponse>
                <TypeDefinitionAnchorPart part="fields">
                    <GraphqlSection
                        title="Returns"
                        description={
                            <span className="text-sm text-(color:--grayscale-a11)">
                                {renderTypeShorthand(
                                    operation.returnType,
                                    { withArticle: true, isGraphQL: true },
                                    types
                                )}
                            </span>
                        }
                    >
                        {hasExpandableFields(operation.returnType, types) && (
                            <TypeDefinitionAnchorPart part="body">
                                <TypeReferenceDefinitions
                                    shape={operation.returnType}
                                    types={types}
                                    location="response"
                                    lang={lang}
                                    isGraphQL
                                />
                            </TypeDefinitionAnchorPart>
                        )}
                    </GraphqlSection>
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}
