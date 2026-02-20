import * as z from "zod";

import { AvailabilitySchema, PropertyKeySchema, TypeIdSchema } from "./commons";

export const ObjectPropertyAccessSchema = z.enum(["READ_ONLY", "WRITE_ONLY"]);
export type ObjectPropertyAccess = z.infer<typeof ObjectPropertyAccessSchema>;

export const TypeReferenceIdDefaultSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("enum"), value: z.string() })
]);
export type TypeReferenceIdDefault = z.infer<typeof TypeReferenceIdDefaultSchema>;

export const PrimitiveTypeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("integer") }),
    z.object({ type: z.literal("double") }),
    z.object({ type: z.literal("string") }),
    z.object({ type: z.literal("long") }),
    z.object({ type: z.literal("boolean") }),
    z.object({ type: z.literal("datetime") }),
    z.object({ type: z.literal("uuid") }),
    z.object({ type: z.literal("base64") }),
    z.object({ type: z.literal("date") }),
    z.object({ type: z.literal("bigInteger") }),
    z.object({ type: z.literal("uint") }),
    z.object({ type: z.literal("uint64") })
]);
export type PrimitiveType = z.infer<typeof PrimitiveTypeSchema>;

export const LiteralTypeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("booleanLiteral"), value: z.boolean() }),
    z.object({ type: z.literal("stringLiteral"), value: z.string() })
]);
export type LiteralType = z.infer<typeof LiteralTypeSchema>;

export const UnknownTypeSchema = z.object({
    displayName: z.string().nullish()
});
export type UnknownType = z.infer<typeof UnknownTypeSchema>;

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
        id: string;
        default?: TypeReferenceIdDefault | null;
    }
    export interface Primitive {
        type: "primitive";
        value: PrimitiveType;
    }
    export interface Optional {
        type: "optional";
        shape: TypeShape;
        default?: unknown | null;
    }
    export interface Nullable {
        type: "nullable";
        shape: TypeShape;
    }
    export interface List {
        type: "list";
        itemShape: TypeShape;
        minItems?: number | null;
        maxItems?: number | null;
    }
    export interface Set {
        type: "set";
        itemShape: TypeShape;
        minItems?: number | null;
        maxItems?: number | null;
    }
    export interface Map {
        type: "map";
        keyShape: TypeShape;
        valueShape: TypeShape;
        minProperties?: number | null;
        maxProperties?: number | null;
    }
    export interface Literal {
        type: "literal";
        value: LiteralType;
    }
    export interface Unknown extends UnknownType {
        type: "unknown";
    }
}

export interface ObjectType {
    extends: string[];
    properties: ObjectProperty[];
    extraProperties?: TypeReference | null;
}

export interface ObjectProperty {
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    valueShape: TypeShape;
    propertyAccess?: ObjectPropertyAccess | null;
}

export interface ParameterProperty extends ObjectProperty {
    explode?: boolean | null;
}

export interface UndiscriminatedUnionVariant {
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    displayName?: string | null;
    shape: TypeShape;
}

export interface UndiscriminatedUnionType {
    variants: UndiscriminatedUnionVariant[];
}

export interface DiscriminatedUnionVariant extends ObjectType {
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    discriminantValue: string;
    displayName?: string | null;
}

export interface DiscriminatedUnionType {
    discriminant: string;
    variants: DiscriminatedUnionVariant[];
}

export const ObjectPropertySchema: z.ZodType<ObjectProperty> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        key: PropertyKeySchema,
        valueShape: TypeShapeSchema,
        propertyAccess: ObjectPropertyAccessSchema.nullish()
    })
);

export const ParameterPropertySchema: z.ZodType<ParameterProperty> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        key: PropertyKeySchema,
        valueShape: TypeShapeSchema,
        propertyAccess: ObjectPropertyAccessSchema.nullish(),
        explode: z.boolean().nullish()
    })
);

export const ObjectTypeSchema: z.ZodType<ObjectType> = z.lazy(() =>
    z.object({
        extends: z.array(TypeIdSchema),
        properties: z.array(ObjectPropertySchema),
        extraProperties: TypeReferenceSchema.nullish()
    })
);

export const UndiscriminatedUnionVariantSchema: z.ZodType<UndiscriminatedUnionVariant> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        displayName: z.string().nullish(),
        shape: TypeShapeSchema
    })
);

export const UndiscriminatedUnionTypeSchema: z.ZodType<UndiscriminatedUnionType> = z.lazy(() =>
    z.object({
        variants: z.array(UndiscriminatedUnionVariantSchema)
    })
);

export const DiscriminatedUnionVariantSchema: z.ZodType<DiscriminatedUnionVariant> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        discriminantValue: z.string(),
        displayName: z.string().nullish(),
        extends: z.array(TypeIdSchema),
        properties: z.array(ObjectPropertySchema),
        extraProperties: TypeReferenceSchema.nullish()
    })
);

export const DiscriminatedUnionTypeSchema: z.ZodType<DiscriminatedUnionType> = z.lazy(() =>
    z.object({
        discriminant: PropertyKeySchema,
        variants: z.array(DiscriminatedUnionVariantSchema)
    })
);

export const TypeShapeSchema: z.ZodType<TypeShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("alias"),
            value: TypeReferenceSchema
        }),
        z.object({
            type: z.literal("enum"),
            default: z.string().nullish(),
            values: z.array(EnumValueSchema)
        }),
        z.object({
            type: z.literal("undiscriminatedUnion"),
            variants: z.array(UndiscriminatedUnionVariantSchema)
        }),
        z.object({
            type: z.literal("discriminatedUnion"),
            discriminant: PropertyKeySchema,
            variants: z.array(DiscriminatedUnionVariantSchema)
        }),
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(ObjectPropertySchema),
            extraProperties: TypeReferenceSchema.nullish()
        })
    ])
);

export const TypeReferenceSchema: z.ZodType<TypeReference> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("id"),
            id: TypeIdSchema,
            default: TypeReferenceIdDefaultSchema.nullish()
        }),
        z.object({
            type: z.literal("primitive"),
            value: PrimitiveTypeSchema
        }),
        z.object({
            type: z.literal("optional"),
            shape: TypeShapeSchema,
            default: z.unknown().nullish()
        }),
        z.object({
            type: z.literal("nullable"),
            shape: TypeShapeSchema
        }),
        z.object({
            type: z.literal("list"),
            itemShape: TypeShapeSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("set"),
            itemShape: TypeShapeSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("map"),
            keyShape: TypeShapeSchema,
            valueShape: TypeShapeSchema,
            minProperties: z.number().int().nullish(),
            maxProperties: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("literal"),
            value: LiteralTypeSchema
        }),
        z.object({
            type: z.literal("unknown"),
            displayName: z.string().nullish()
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

export const BytesRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    isOptional: z.boolean(),
    contentType: ContentTypeSchema.nullish()
});
export type BytesRequest = z.infer<typeof BytesRequestSchema>;

export const FormDataPropertySchema: z.ZodType<FormDataField> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("file"),
            description: z.string().nullish(),
            availability: AvailabilitySchema.nullish(),
            key: PropertyKeySchema,
            isOptional: z.boolean(),
            contentType: ContentTypeSchema.nullish()
        }),
        z.object({
            type: z.literal("files"),
            description: z.string().nullish(),
            availability: AvailabilitySchema.nullish(),
            key: PropertyKeySchema,
            isOptional: z.boolean(),
            contentType: ContentTypeSchema.nullish()
        }),
        z.object({
            type: z.literal("property"),
            description: z.string().nullish(),
            availability: AvailabilitySchema.nullish(),
            key: PropertyKeySchema,
            valueShape: TypeShapeSchema,
            propertyAccess: ObjectPropertyAccessSchema.nullish(),
            contentType: ContentTypeSchema.nullish(),
            exploded: z.boolean().nullish()
        })
    ])
);

export type FormDataFile = {
    type: "file";
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    isOptional: boolean;
    contentType?: ContentType | null;
};

export type FormDataFiles = {
    type: "files";
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    isOptional: boolean;
    contentType?: ContentType | null;
};

export type FormDataPropertyVariant = {
    type: "property";
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    valueShape: TypeShape;
    propertyAccess?: ObjectPropertyAccess | null;
    contentType?: ContentType | null;
    exploded?: boolean | null;
};

export type FormDataField = FormDataFile | FormDataFiles | FormDataPropertyVariant;

export const FormDataRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    fields: z.array(FormDataPropertySchema)
});
export type FormDataRequest = z.infer<typeof FormDataRequestSchema>;

export const NullableTypeSchema: z.ZodType<{ shape: TypeShape }> = z.lazy(() =>
    z.object({
        shape: TypeShapeSchema
    })
);

export const OptionalTypeSchema: z.ZodType<{ shape: TypeShape; default?: unknown | null }> = z.lazy(() =>
    z.object({
        shape: TypeShapeSchema,
        default: z.unknown().nullish()
    })
);

export const ListTypeSchema: z.ZodType<{ itemShape: TypeShape; minItems?: number | null; maxItems?: number | null }> =
    z.lazy(() =>
        z.object({
            itemShape: TypeShapeSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        })
    );

export const SetTypeSchema: z.ZodType<{ itemShape: TypeShape; minItems?: number | null; maxItems?: number | null }> =
    z.lazy(() =>
        z.object({
            itemShape: TypeShapeSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        })
    );

export const MapTypeSchema: z.ZodType<{
    keyShape: TypeShape;
    valueShape: TypeShape;
    minProperties?: number | null;
    maxProperties?: number | null;
}> = z.lazy(() =>
    z.object({
        keyShape: TypeShapeSchema,
        valueShape: TypeShapeSchema,
        minProperties: z.number().int().nullish(),
        maxProperties: z.number().int().nullish()
    })
);
