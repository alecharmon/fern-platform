import * as z from "zod";

import { AvailabilitySchema, PropertyKeySchema, TypeIdSchema } from "../register/commons";

export const ObjectPropertyAccessSchema = z.enum(["READ_ONLY", "WRITE_ONLY"]);
export type ObjectPropertyAccess = z.infer<typeof ObjectPropertyAccessSchema>;

export const TypeReferenceIdDefaultSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("enum"), value: z.string() })
]);
export type TypeReferenceIdDefault = z.infer<typeof TypeReferenceIdDefaultSchema>;

export const IntegerTypeSchema = z.object({
    minimum: z.number().int().nullish(),
    maximum: z.number().int().nullish(),
    exclusiveMinimum: z.number().int().nullish(),
    exclusiveMaximum: z.number().int().nullish(),
    multipleOf: z.number().int().nullish(),
    default: z.number().int().nullish()
});
export type IntegerType = z.infer<typeof IntegerTypeSchema>;

export const DoubleTypeSchema = z.object({
    minimum: z.number().nullish(),
    maximum: z.number().nullish(),
    exclusiveMinimum: z.number().nullish(),
    exclusiveMaximum: z.number().nullish(),
    multipleOf: z.number().nullish(),
    default: z.number().nullish()
});
export type DoubleType = z.infer<typeof DoubleTypeSchema>;

export const StringTypeSchema = z.object({
    format: z.string().nullish(),
    regex: z.string().nullish(),
    minLength: z.number().int().nullish(),
    maxLength: z.number().int().nullish(),
    default: z.string().nullish()
});
export type StringType = z.infer<typeof StringTypeSchema>;

export const LongTypeSchema = z.object({
    minimum: z.number().nullish(),
    maximum: z.number().nullish(),
    exclusiveMinimum: z.number().nullish(),
    exclusiveMaximum: z.number().nullish(),
    multipleOf: z.number().nullish(),
    default: z.number().nullish()
});
export type LongType = z.infer<typeof LongTypeSchema>;

export const BooleanTypeSchema = z.object({
    default: z.boolean().nullish()
});
export type BooleanType = z.infer<typeof BooleanTypeSchema>;

export const DatetimeTypeSchema = z.object({
    default: z.string().nullish()
});
export type DatetimeType = z.infer<typeof DatetimeTypeSchema>;

export const UuidTypeSchema = z.object({
    default: z.string().nullish()
});
export type UuidType = z.infer<typeof UuidTypeSchema>;

export const Base64TypeSchema = z.object({
    default: z.string().nullish(),
    mimeType: z.string().nullish()
});
export type Base64Type = z.infer<typeof Base64TypeSchema>;

export const DateTypeSchema = z.object({
    default: z.string().nullish()
});
export type DateType = z.infer<typeof DateTypeSchema>;

export const BigIntegerTypeSchema = z.object({
    default: z.string().nullish()
});
export type BigIntegerType = z.infer<typeof BigIntegerTypeSchema>;

export const UintTypeSchema = z.object({
    minimum: z.number().int().nullish(),
    maximum: z.number().int().nullish(),
    exclusiveMinimum: z.number().int().nullish(),
    exclusiveMaximum: z.number().int().nullish(),
    multipleOf: z.number().int().nullish(),
    default: z.number().int().nullish()
});
export type UintType = z.infer<typeof UintTypeSchema>;

export const Uint64TypeSchema = z.object({
    minimum: z.number().nullish(),
    maximum: z.number().nullish(),
    exclusiveMinimum: z.number().nullish(),
    exclusiveMaximum: z.number().nullish(),
    multipleOf: z.number().nullish(),
    default: z.number().nullish()
});
export type Uint64Type = z.infer<typeof Uint64TypeSchema>;

export const ScalarTypeSchema = z.object({
    name: z.string(),
    description: z.string().nullish(),
    default: z.unknown().nullish()
});
export type ScalarType = z.infer<typeof ScalarTypeSchema>;

export const PrimitiveTypeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("integer"), ...IntegerTypeSchema.shape }),
    z.object({ type: z.literal("double"), ...DoubleTypeSchema.shape }),
    z.object({ type: z.literal("string"), ...StringTypeSchema.shape }),
    z.object({ type: z.literal("long"), ...LongTypeSchema.shape }),
    z.object({ type: z.literal("boolean"), ...BooleanTypeSchema.shape }),
    z.object({ type: z.literal("datetime"), ...DatetimeTypeSchema.shape }),
    z.object({ type: z.literal("uuid"), ...UuidTypeSchema.shape }),
    z.object({ type: z.literal("base64"), ...Base64TypeSchema.shape }),
    z.object({ type: z.literal("date"), ...DateTypeSchema.shape }),
    z.object({ type: z.literal("bigInteger"), ...BigIntegerTypeSchema.shape }),
    z.object({ type: z.literal("uint"), ...UintTypeSchema.shape }),
    z.object({ type: z.literal("uint64"), ...Uint64TypeSchema.shape }),
    z.object({ type: z.literal("scalar"), ...ScalarTypeSchema.shape })
]);
export type PrimitiveType = z.infer<typeof PrimitiveTypeSchema>;

export const LiteralTypeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("booleanLiteral"), value: z.boolean() }),
    z.object({ type: z.literal("stringLiteral"), value: z.string() })
]);
export type LiteralType = z.infer<typeof LiteralTypeSchema>;

export type TypeReference =
    | TypeReference.Id
    | TypeReference.Primitive
    | TypeReference.Optional
    | TypeReference.Nullable
    | TypeReference.List
    | TypeReference.Set
    | TypeReference.Map
    | TypeReference.Literal
    | TypeReference.Unknown;

export namespace TypeReference {
    export interface Id {
        type: "id";
        value: string;
        default?: TypeReferenceIdDefault | null;
    }
    export interface Primitive {
        type: "primitive";
        value: PrimitiveType;
    }
    export interface Optional {
        type: "optional";
        itemType: TypeReference;
        defaultValue?: unknown | null;
    }
    export interface Nullable {
        type: "nullable";
        itemType: TypeReference;
    }
    export interface List {
        type: "list";
        itemType: TypeReference;
        minItems?: number | null;
        maxItems?: number | null;
    }
    export interface Set {
        type: "set";
        itemType: TypeReference;
        minItems?: number | null;
        maxItems?: number | null;
    }
    export interface Map {
        type: "map";
        keyType: TypeReference;
        valueType: TypeReference;
        minProperties?: number | null;
        maxProperties?: number | null;
    }
    export interface Literal {
        type: "literal";
        value: LiteralType;
    }
    export interface Unknown {
        type: "unknown";
    }
}

export const TypeReferenceSchema: z.ZodType<TypeReference> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("id"),
            value: TypeIdSchema,
            default: TypeReferenceIdDefaultSchema.nullish()
        }),
        z.object({
            type: z.literal("primitive"),
            value: PrimitiveTypeSchema
        }),
        z.object({
            type: z.literal("optional"),
            itemType: TypeReferenceSchema,
            defaultValue: z.unknown().nullish()
        }),
        z.object({
            type: z.literal("nullable"),
            itemType: TypeReferenceSchema
        }),
        z.object({
            type: z.literal("list"),
            itemType: TypeReferenceSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("set"),
            itemType: TypeReferenceSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("map"),
            keyType: TypeReferenceSchema,
            valueType: TypeReferenceSchema,
            minProperties: z.number().int().nullish(),
            maxProperties: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("literal"),
            value: LiteralTypeSchema
        }),
        z.object({
            type: z.literal("unknown")
        })
    ])
);

export const ObjectPropertySchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    key: PropertyKeySchema,
    valueType: TypeReferenceSchema,
    propertyAccess: ObjectPropertyAccessSchema.nullish()
});
export type ObjectProperty = z.infer<typeof ObjectPropertySchema>;

export const ObjectTypeSchema = z.object({
    extends: z.array(TypeIdSchema),
    properties: z.array(ObjectPropertySchema),
    extraProperties: TypeReferenceSchema.nullish()
});
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

export const EnumValueSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    value: z.string()
});
export type EnumValue = z.infer<typeof EnumValueSchema>;

export const EnumTypeSchema = z.object({
    default: z.string().nullish(),
    values: z.array(EnumValueSchema)
});
export type EnumType = z.infer<typeof EnumTypeSchema>;

export const UndiscriminatedUnionVariantSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    displayName: z.string().nullish(),
    type: TypeReferenceSchema
});
export type UndiscriminatedUnionVariant = z.infer<typeof UndiscriminatedUnionVariantSchema>;

export const UndiscriminatedUnionTypeSchema = z.object({
    variants: z.array(UndiscriminatedUnionVariantSchema)
});
export type UndiscriminatedUnionType = z.infer<typeof UndiscriminatedUnionTypeSchema>;

export const DiscriminatedUnionVariantSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    discriminantValue: z.string(),
    displayName: z.string().nullish(),
    additionalProperties: ObjectTypeSchema
});
export type DiscriminatedUnionVariant = z.infer<typeof DiscriminatedUnionVariantSchema>;

export const DiscriminatedUnionTypeSchema = z.object({
    discriminant: z.string(),
    variants: z.array(DiscriminatedUnionVariantSchema)
});
export type DiscriminatedUnionType = z.infer<typeof DiscriminatedUnionTypeSchema>;

export type TypeShape =
    | TypeShape.Alias
    | TypeShape.Enum
    | TypeShape.UndiscriminatedUnion
    | TypeShape.DiscriminatedUnion
    | TypeShape.Object_;

export namespace TypeShape {
    export interface Alias {
        type: "alias";
        value: TypeReference;
    }
    export interface Enum extends EnumType {
        type: "enum";
    }
    export interface UndiscriminatedUnion extends UndiscriminatedUnionType {
        type: "undiscriminatedUnion";
    }
    export interface DiscriminatedUnion extends DiscriminatedUnionType {
        type: "discriminatedUnion";
    }
    export interface Object_ extends ObjectType {
        type: "object";
    }
}

export const TypeShapeSchema: z.ZodType<TypeShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("alias"),
            value: TypeReferenceSchema
        }),
        z.object({
            type: z.literal("enum"),
            ...EnumTypeSchema.shape
        }),
        z.object({
            type: z.literal("undiscriminatedUnion"),
            ...UndiscriminatedUnionTypeSchema.shape
        }),
        z.object({
            type: z.literal("discriminatedUnion"),
            ...DiscriminatedUnionTypeSchema.shape
        }),
        z.object({
            type: z.literal("object"),
            ...ObjectTypeSchema.shape
        })
    ])
);

export const TypeDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    shape: TypeShapeSchema,
    displayName: z.string().nullish()
});
export type TypeDefinition = z.infer<typeof TypeDefinitionSchema>;

export const ContentTypeSchema = z.union([z.string(), z.array(z.string())]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const FilePropertySingleSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    key: PropertyKeySchema,
    isOptional: z.boolean(),
    contentType: ContentTypeSchema.nullish()
});
export type FilePropertySingle = z.infer<typeof FilePropertySingleSchema>;

export const FilePropertyArraySchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    key: PropertyKeySchema,
    isOptional: z.boolean(),
    contentType: ContentTypeSchema.nullish()
});
export type FilePropertyArray = z.infer<typeof FilePropertyArraySchema>;

export const FormDataFilePropertySchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("file"), ...FilePropertySingleSchema.shape }),
    z.object({ type: z.literal("fileArray"), ...FilePropertyArraySchema.shape })
]);
export type FormDataFileProperty = z.infer<typeof FormDataFilePropertySchema>;

export const FormDataBodyPropertySchema = z.object({
    ...ObjectPropertySchema.shape,
    contentType: ContentTypeSchema.nullish(),
    exploded: z.boolean().nullish()
});
export type FormDataBodyProperty = z.infer<typeof FormDataBodyPropertySchema>;

export const FormDataPropertySchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("file"), value: FormDataFilePropertySchema }),
    z.object({ type: z.literal("bodyProperty"), ...FormDataBodyPropertySchema.shape })
]);
export type FormDataProperty = z.infer<typeof FormDataPropertySchema>;

export const FormDataRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    properties: z.array(FormDataPropertySchema)
});
export type FormDataRequest = z.infer<typeof FormDataRequestSchema>;

export const BytesRequestSchema = z.object({
    isOptional: z.boolean(),
    contentType: z.string().nullish()
});
export type BytesRequest = z.infer<typeof BytesRequestSchema>;
