import "server-only";

import type { GraphqlContext, TypeShape } from "@fern-api/fdr-sdk/api-definition";
import { GraphqlSection } from "@fern-docs/components/api-reference/graphql/GraphqlSection";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionResponse
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

function isListType(shape: TypeShape): boolean {
    if (shape.type === "alias") {
        if (shape.value.type === "list" || shape.value.type === "set") {
            return true;
        }
        if (shape.value.type === "optional" || shape.value.type === "nullable") {
            return isListType(shape.value.shape);
        }
    }
    return false;
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
                                        description={arg.description}
                                        availability={arg.availability}
                                        types={types}
                                        lang={lang}
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
                        title="Fields"
                        description={
                            isListType(operation.returnType) ? (
                                <span className="text-sm text-(color:--grayscale-a11)">Returns a list</span>
                            ) : undefined
                        }
                    >
                        <TypeDefinitionAnchorPart part="body">
                            <TypeReferenceDefinitions
                                shape={operation.returnType}
                                types={types}
                                location="response"
                                lang={lang}
                            />
                        </TypeDefinitionAnchorPart>
                    </GraphqlSection>
                </TypeDefinitionAnchorPart>
            </TypeDefinitionResponse>
        </>
    );
}
