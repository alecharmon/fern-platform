import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

/**
 * Serialized MDX description that can be rendered client-side.
 * This type matches the bundle's serialize-description output.
 */
export interface SerializedDescription {
    code: string;
    jsxElements: string[];
    engine: "next-remote" | "plaintext";
    /** Pre-rendered HTML from remote renderer (optional) */
    _contentHtml?: string;
    /** Present when rendering failed; signals the client to show an error UI */
    _error?: { message: string };
}

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
