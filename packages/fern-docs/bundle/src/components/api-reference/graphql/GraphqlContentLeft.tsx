import "server-only";

import type { GraphqlContext } from "@fern-api/fdr-sdk/api-definition";
import { GraphqlSection } from "@fern-docs/components/api-reference/graphql/GraphqlSection";
import {
    TypeDefinitionAnchorPart,
    TypeDefinitionResponse
} from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionContext";
import { WithSeparator } from "@fern-docs/components/api-reference/type-definitions/TypeDefinitionDetails";
import { MdxServerComponentProseSuspense } from "@/mdx/components/server-component";

import { PropertyWithShape } from "../type-definitions/ObjectProperty";
import { TypeReferenceDefinitions } from "../type-definitions/TypeReferenceDefinitions";

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
            <TypeDefinitionAnchorPart part="request">
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
                <TypeDefinitionAnchorPart part="response">
                    <GraphqlSection
                        title="Return Type"
                        description={
                            <MdxServerComponentProseSuspense
                                size="sm"
                                className="text-(color:--grayscale-a11)"
                                mdx={undefined}
                            />
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
