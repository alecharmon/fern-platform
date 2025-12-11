import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import { type SerializedDescription, serializeDescription } from "./serialize-description";

/**
 * Re-export SerializedDescription for consumers
 */
export type { SerializedDescription };

/**
 * Extended type interfaces with optional serialized descriptions
 */
export interface WithSerializedDescription {
    serializedDescription?: SerializedDescription;
}

export type ObjectPropertyWithSerializedDescription = ApiDefinition.ObjectProperty & WithSerializedDescription;

export type EnumValueWithSerializedDescription = ApiDefinition.EnumValue & WithSerializedDescription;

export type UndiscriminatedUnionVariantWithSerializedDescription = ApiDefinition.UndiscriminatedUnionVariant &
    WithSerializedDescription;

export type DiscriminatedUnionVariantWithSerializedDescription = ApiDefinition.DiscriminatedUnionVariant &
    WithSerializedDescription & {
        properties: ObjectPropertyWithSerializedDescription[];
    };

export type TypeShapeWithSerializedDescriptions =
    | ApiDefinition.TypeShape.Alias
    | (ApiDefinition.TypeShape.Enum & { values: EnumValueWithSerializedDescription[] })
    | (ApiDefinition.TypeShape.UndiscriminatedUnion & {
          variants: UndiscriminatedUnionVariantWithSerializedDescription[];
      })
    | (ApiDefinition.TypeShape.DiscriminatedUnion & {
          variants: DiscriminatedUnionVariantWithSerializedDescription[];
      })
    | (ApiDefinition.TypeShape.Object_ & { properties: ObjectPropertyWithSerializedDescription[] });

export type TypeDefinitionWithSerializedDescriptions = ApiDefinition.TypeDefinition &
    WithSerializedDescription & {
        shape: TypeShapeWithSerializedDescriptions;
    };

/**
 * Serializes all descriptions in an ObjectProperty.
 * Note: We don't recursively serialize nested valueShape descriptions here
 * because nested types are referenced by ID and will be serialized separately
 * as part of the types map.
 */
async function serializeObjectPropertyDescriptions(
    property: ApiDefinition.ObjectProperty
): Promise<ObjectPropertyWithSerializedDescription> {
    const serializedDescription = await serializeDescription(property.description);

    return {
        ...property,
        serializedDescription
    };
}

/**
 * Serializes all descriptions in an EnumValue
 */
async function serializeEnumValueDescriptions(
    enumValue: ApiDefinition.EnumValue
): Promise<EnumValueWithSerializedDescription> {
    const serializedDescription = await serializeDescription(enumValue.description);

    return {
        ...enumValue,
        serializedDescription
    };
}

/**
 * Serializes all descriptions in an UndiscriminatedUnionVariant
 */
async function serializeUndiscriminatedUnionVariantDescriptions(
    variant: ApiDefinition.UndiscriminatedUnionVariant
): Promise<UndiscriminatedUnionVariantWithSerializedDescription> {
    const serializedDescription = await serializeDescription(variant.description);

    return {
        ...variant,
        serializedDescription
    };
}

/**
 * Serializes all descriptions in a DiscriminatedUnionVariant
 */
async function serializeDiscriminatedUnionVariantDescriptions(
    variant: ApiDefinition.DiscriminatedUnionVariant
): Promise<DiscriminatedUnionVariantWithSerializedDescription> {
    const [serializedDescription, properties] = await Promise.all([
        serializeDescription(variant.description),
        Promise.all(variant.properties.map((prop) => serializeObjectPropertyDescriptions(prop)))
    ]);

    return {
        ...variant,
        serializedDescription,
        properties
    };
}

/**
 * Serializes all descriptions in a TypeShape
 */
async function serializeTypeShapeDescriptions(
    shape: ApiDefinition.TypeShape
): Promise<TypeShapeWithSerializedDescriptions> {
    switch (shape.type) {
        case "alias":
            // Alias shapes point to type references - no descriptions to serialize here
            return shape;
        case "enum":
            return {
                ...shape,
                values: await Promise.all(shape.values.map((v) => serializeEnumValueDescriptions(v)))
            };
        case "undiscriminatedUnion":
            return {
                ...shape,
                variants: await Promise.all(
                    shape.variants.map((v) => serializeUndiscriminatedUnionVariantDescriptions(v))
                )
            };
        case "discriminatedUnion":
            return {
                ...shape,
                variants: await Promise.all(
                    shape.variants.map((v) => serializeDiscriminatedUnionVariantDescriptions(v))
                )
            };
        case "object":
            return {
                ...shape,
                properties: await Promise.all(shape.properties.map((p) => serializeObjectPropertyDescriptions(p)))
            };
    }
}

/**
 * Serializes all descriptions in a TypeDefinition and its nested structures.
 * This includes:
 * - The type definition's own description
 * - Object property descriptions
 * - Enum value descriptions
 * - Union variant descriptions
 * - Nested type descriptions
 */
export async function serializeTypeDefinitionDescriptions(
    typeDefinition: ApiDefinition.TypeDefinition
): Promise<TypeDefinitionWithSerializedDescriptions> {
    const [serializedDescription, shape] = await Promise.all([
        serializeDescription(typeDefinition.description),
        serializeTypeShapeDescriptions(typeDefinition.shape)
    ]);

    return {
        ...typeDefinition,
        serializedDescription,
        shape
    };
}

/**
 * Serializes descriptions for all type definitions in a types map
 */
export async function serializeAllTypeDefinitionDescriptions(
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): Promise<Record<ApiDefinition.TypeId, TypeDefinitionWithSerializedDescriptions>> {
    const entries = Object.entries(types);
    const serializedEntries = await Promise.all(
        entries.map(async ([id, typeDef]) => {
            const serialized = await serializeTypeDefinitionDescriptions(typeDef);
            return [id, serialized] as const;
        })
    );

    return Object.fromEntries(serializedEntries);
}
