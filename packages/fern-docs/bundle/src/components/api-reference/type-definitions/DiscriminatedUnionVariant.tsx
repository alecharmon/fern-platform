import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import titleCase from "@fern-api/ui-core-utils/titleCase";
import { compact } from "es-toolkit/array";

import { PropertyWithShape } from "./ObjectProperty";
import { TypeDefinitionPathPart } from "./TypeDefinitionContext";
import { WithSeparator } from "./TypeDefinitionDetails";

export function DiscriminatedUnionVariant({
    discriminant,
    unionVariant,
    types,
    location,
    lang
}: {
    discriminant: ApiDefinition.PropertyKey;
    unionVariant: ApiDefinition.DiscriminatedUnionVariant;
    types: Record<string, ApiDefinition.TypeDefinition>;
    location?: "request" | "response";
    lang: string;
}) {
    const unwrapped = ApiDefinition.unwrapDiscriminatedUnionVariant({ discriminant }, unionVariant, types);

    const description = compact([unionVariant.description, ...unwrapped.descriptions])[0];

    /**
     * HACKHACK: This is a hack to get an undiscriminated union that is extended by the current discriminated union variant to render correctly
     * - There is no support for extended discriminataed unions
     * - If there are multiple extended (undiscriminated) unions, they will not render correctly
     * - Ideally, when there are multiple extended unions, we should find all possible permutations of them and render accordingly
     */
    const extendedUndiscriminatedUnions = unionVariant.extends
        .map((extendedType) => {
            const extendedTypeDefinition = types[extendedType];
            if (extendedTypeDefinition?.shape.type !== "undiscriminatedUnion") {
                return null;
            }
            return extendedTypeDefinition.shape as ApiDefinition.TypeShape.UndiscriminatedUnion;
        })
        .filter((shape): shape is ApiDefinition.TypeShape.UndiscriminatedUnion => shape != null);

    return (
        <TypeDefinitionPathPart
            part={{
                type: "objectFilter",
                propertyName: discriminant,
                requiredStringValue: unionVariant.discriminantValue
            }}
        >
            {extendedUndiscriminatedUnions.length > 0 ? (
                <WithSeparator>
                    {extendedUndiscriminatedUnions.map((extendedShape, index) => (
                        <PropertyWithShape
                            key={`discriminated-variant-extended-type-${index}`}
                            name={unionVariant.discriminantValue ?? titleCase(unionVariant.discriminantValue)}
                            description={description}
                            shape={extendedShape}
                            availability={unionVariant.availability}
                            types={types}
                            location={location}
                            additionalProperties={unwrapped.properties}
                            lang={lang}
                        />
                    ))}
                </WithSeparator>
            ) : (
                <PropertyWithShape
                    name={unionVariant.discriminantValue ?? titleCase(unionVariant.discriminantValue)}
                    description={description}
                    shape={{
                        type: "object" as const,
                        properties: unwrapped.properties,
                        extends: [],
                        extraProperties: unwrapped.extraProperties
                    }}
                    availability={unionVariant.availability}
                    types={types}
                    location={location}
                    lang={lang}
                />
            )}
        </TypeDefinitionPathPart>
    );
}
