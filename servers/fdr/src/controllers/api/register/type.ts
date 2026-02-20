import * as z from "zod";
import type { DiscriminatedUnionType, EnumType, ObjectType, TypeReference } from "../shared";
import {
    AvailabilitySchema,
    DiscriminatedUnionTypeSchema,
    EnumTypeSchema,
    ObjectTypeSchema,
    TypeReferenceSchema
} from "../shared";

export type {
    Base64Type,
    BigIntegerType,
    BooleanType,
    ContentType,
    DateType,
    DatetimeType,
    DiscriminatedUnionType,
    DiscriminatedUnionVariant,
    DoubleType,
    EnumType,
    EnumValue,
    FilePropertyArray,
    FilePropertySingle,
    FormDataBodyProperty,
    FormDataFileProperty,
    FormDataProperty,
    FormDataRequest,
    IntegerType,
    LiteralType,
    LongType,
    ObjectProperty,
    ObjectPropertyAccess,
    ObjectType,
    PrimitiveType,
    ScalarType,
    StringType,
    TypeReference,
    TypeReferenceIdDefault,
    Uint64Type,
    UintType,
    UuidType
} from "../shared";
export {
    Base64TypeSchema,
    BigIntegerTypeSchema,
    BooleanTypeSchema,
    ContentTypeSchema,
    DateTypeSchema,
    DatetimeTypeSchema,
    DiscriminatedUnionTypeSchema,
    DiscriminatedUnionVariantSchema,
    DoubleTypeSchema,
    EnumTypeSchema,
    EnumValueSchema,
    FilePropertyArraySchema,
    FilePropertySingleSchema,
    FormDataBodyPropertySchema,
    FormDataFilePropertySchema,
    FormDataPropertySchema,
    FormDataRequestSchema,
    IntegerTypeSchema,
    LiteralTypeSchema,
    LongTypeSchema,
    ObjectPropertyAccessSchema,
    ObjectPropertySchema,
    ObjectTypeSchema,
    PrimitiveTypeSchema,
    ScalarTypeSchema,
    StringTypeSchema,
    TypeReferenceIdDefaultSchema,
    TypeReferenceSchema,
    Uint64TypeSchema,
    UintTypeSchema,
    UuidTypeSchema
} from "../shared";

export const UndiscriminatedUnionVariantSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    typeName: z.string().nullish(),
    type: TypeReferenceSchema,
    displayName: z.string().nullish()
});
export type UndiscriminatedUnionVariant = z.infer<typeof UndiscriminatedUnionVariantSchema>;

export const UndiscriminatedUnionTypeSchema = z.object({
    variants: z.array(UndiscriminatedUnionVariantSchema)
});
export type UndiscriminatedUnionType = z.infer<typeof UndiscriminatedUnionTypeSchema>;

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

export const BytesRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    isOptional: z.boolean(),
    contentType: z.string().nullish()
});
export type BytesRequest = z.infer<typeof BytesRequestSchema>;
