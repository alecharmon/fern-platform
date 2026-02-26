import * as z from "zod";

import {
    AuthSchemeIdSchema,
    AvailabilitySchema,
    Base64TypeSchema,
    BigIntegerTypeSchema,
    BooleanTypeSchema,
    DateTypeSchema,
    DatetimeTypeSchema,
    DoubleTypeSchema,
    EndpointIdSchema,
    EndpointPathPartSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    GraphQlOperationIdSchema,
    HttpMethodSchema,
    IntegerTypeSchema,
    LongTypeSchema,
    MultipleAuthTypeSchema,
    PropertyKeySchema,
    ProtocolSchema,
    ScalarTypeSchema,
    StringTypeSchema,
    SubpackageIdSchema,
    TypeIdSchema,
    Uint64TypeSchema,
    UintTypeSchema,
    UuidTypeSchema,
    WebhookHttpMethodSchema,
    WebhookIdSchema,
    WebSocketIdSchema,
    WebSocketMessageIdSchema,
    WebSocketMessageOriginSchema
} from "./shared.js";

// ── Latest commons ───────────────────────────────────────────────────────

export const PathPartSchema = EndpointPathPartSchema;
export type PathPart = z.infer<typeof PathPartSchema>;

export const WithNamespaceSchema = z.object({
    namespace: z.array(SubpackageIdSchema).nullish()
});
export type WithNamespace = z.infer<typeof WithNamespaceSchema>;

// ── Latest auth ──────────────────────────────────────────────────────────

import { BasicAuthSchema, BearerAuthSchema, HeaderAuthSchema, OAuthSchema } from "./shared.js";

export { BasicAuthSchema, BearerAuthSchema, HeaderAuthSchema, OAuthSchema };

export const LatestAuthSchemeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearerAuth"), ...BearerAuthSchema.shape }),
    z.object({ type: z.literal("basicAuth"), ...BasicAuthSchema.shape }),
    z.object({ type: z.literal("header"), ...HeaderAuthSchema.shape }),
    z.object({ type: z.literal("oAuth"), value: OAuthSchema })
]);
export type LatestAuthScheme = z.infer<typeof LatestAuthSchemeSchema>;

// ── Latest type ──────────────────────────────────────────────────────────

export const LatestObjectPropertyAccessSchema = z.enum(["READ_ONLY", "WRITE_ONLY"]);
export type LatestObjectPropertyAccess = z.infer<typeof LatestObjectPropertyAccessSchema>;

export const LatestTypeReferenceIdDefaultSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("enum"), value: z.string() })
]);
export type LatestTypeReferenceIdDefault = z.infer<typeof LatestTypeReferenceIdDefaultSchema>;

export const LatestPrimitiveTypeSchema = z.discriminatedUnion("type", [
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
export type LatestPrimitiveType = z.infer<typeof LatestPrimitiveTypeSchema>;

export const LatestLiteralTypeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("booleanLiteral"), value: z.boolean() }),
    z.object({ type: z.literal("stringLiteral"), value: z.string() })
]);
export type LatestLiteralType = z.infer<typeof LatestLiteralTypeSchema>;

export const LatestUnknownTypeSchema = z.object({
    displayName: z.string().nullish()
});
export type LatestUnknownType = z.infer<typeof LatestUnknownTypeSchema>;

export const LatestEnumValueSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    value: z.string()
});
export type LatestEnumValue = z.infer<typeof LatestEnumValueSchema>;

export const LatestEnumTypeSchema = z.object({
    default: z.string().nullish(),
    values: z.array(LatestEnumValueSchema)
});
export type LatestEnumType = z.infer<typeof LatestEnumTypeSchema>;

export type LatestTypeShape =
    | LatestTypeShape.Alias
    | LatestTypeShape.Enum
    | LatestTypeShape.UndiscriminatedUnion
    | LatestTypeShape.DiscriminatedUnion
    | LatestTypeShape.Object_;

export namespace LatestTypeShape {
    export interface Alias {
        type: "alias";
        value: LatestTypeReference;
    }
    export interface Enum extends LatestEnumType {
        type: "enum";
    }
    export interface UndiscriminatedUnion extends LatestUndiscriminatedUnionType {
        type: "undiscriminatedUnion";
    }
    export interface DiscriminatedUnion extends LatestDiscriminatedUnionType {
        type: "discriminatedUnion";
    }
    export interface Object_ extends LatestObjectType {
        type: "object";
    }
}

export type LatestTypeReference =
    | LatestTypeReference.Id
    | LatestTypeReference.Primitive
    | LatestTypeReference.Optional
    | LatestTypeReference.Nullable
    | LatestTypeReference.List
    | LatestTypeReference.Set
    | LatestTypeReference.Map
    | LatestTypeReference.Literal
    | LatestTypeReference.Unknown;

export namespace LatestTypeReference {
    export interface Id {
        type: "id";
        id: string;
        default?: LatestTypeReferenceIdDefault | null;
    }
    export interface Primitive {
        type: "primitive";
        value: LatestPrimitiveType;
    }
    export interface Optional {
        type: "optional";
        shape: LatestTypeShape;
        default?: unknown | null;
    }
    export interface Nullable {
        type: "nullable";
        shape: LatestTypeShape;
    }
    export interface List {
        type: "list";
        itemShape: LatestTypeShape;
        minItems?: number | null;
        maxItems?: number | null;
    }
    export interface Set {
        type: "set";
        itemShape: LatestTypeShape;
        minItems?: number | null;
        maxItems?: number | null;
    }
    export interface Map {
        type: "map";
        keyShape: LatestTypeShape;
        valueShape: LatestTypeShape;
        minProperties?: number | null;
        maxProperties?: number | null;
    }
    export interface Literal {
        type: "literal";
        value: LatestLiteralType;
    }
    export interface Unknown extends LatestUnknownType {
        type: "unknown";
    }
}

export interface LatestObjectType {
    extends: string[];
    properties: LatestObjectProperty[];
    extraProperties?: LatestTypeReference | null;
}

export interface LatestObjectProperty {
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    valueShape: LatestTypeShape;
    propertyAccess?: LatestObjectPropertyAccess | null;
}

export interface LatestParameterProperty extends LatestObjectProperty {
    explode?: boolean | null;
}

export interface LatestUndiscriminatedUnionVariant {
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    displayName?: string | null;
    shape: LatestTypeShape;
}

export interface LatestUndiscriminatedUnionType {
    variants: LatestUndiscriminatedUnionVariant[];
}

export interface LatestDiscriminatedUnionVariant extends LatestObjectType {
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    discriminantValue: string;
    displayName?: string | null;
}

export interface LatestDiscriminatedUnionType {
    discriminant: string;
    variants: LatestDiscriminatedUnionVariant[];
}

export const LatestObjectPropertySchema: z.ZodType<LatestObjectProperty> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        key: PropertyKeySchema,
        valueShape: LatestTypeShapeSchema,
        propertyAccess: LatestObjectPropertyAccessSchema.nullish()
    })
);

export const LatestParameterPropertySchema: z.ZodType<LatestParameterProperty> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        key: PropertyKeySchema,
        valueShape: LatestTypeShapeSchema,
        propertyAccess: LatestObjectPropertyAccessSchema.nullish(),
        explode: z.boolean().nullish()
    })
);

export const LatestObjectTypeSchema: z.ZodType<LatestObjectType> = z.lazy(() =>
    z.object({
        extends: z.array(TypeIdSchema),
        properties: z.array(LatestObjectPropertySchema),
        extraProperties: LatestTypeReferenceSchema.nullish()
    })
);

export const LatestUndiscriminatedUnionVariantSchema: z.ZodType<LatestUndiscriminatedUnionVariant> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        displayName: z.string().nullish(),
        shape: LatestTypeShapeSchema
    })
);

export const LatestUndiscriminatedUnionTypeSchema: z.ZodType<LatestUndiscriminatedUnionType> = z.lazy(() =>
    z.object({
        variants: z.array(LatestUndiscriminatedUnionVariantSchema)
    })
);

export const LatestDiscriminatedUnionVariantSchema: z.ZodType<LatestDiscriminatedUnionVariant> = z.lazy(() =>
    z.object({
        description: z.string().nullish(),
        availability: AvailabilitySchema.nullish(),
        discriminantValue: z.string(),
        displayName: z.string().nullish(),
        extends: z.array(TypeIdSchema),
        properties: z.array(LatestObjectPropertySchema),
        extraProperties: LatestTypeReferenceSchema.nullish()
    })
);

export const LatestDiscriminatedUnionTypeSchema: z.ZodType<LatestDiscriminatedUnionType> = z.lazy(() =>
    z.object({
        discriminant: PropertyKeySchema,
        variants: z.array(LatestDiscriminatedUnionVariantSchema)
    })
);

export const LatestTypeShapeSchema: z.ZodType<LatestTypeShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("alias"),
            value: LatestTypeReferenceSchema
        }),
        z.object({
            type: z.literal("enum"),
            default: z.string().nullish(),
            values: z.array(LatestEnumValueSchema)
        }),
        z.object({
            type: z.literal("undiscriminatedUnion"),
            variants: z.array(LatestUndiscriminatedUnionVariantSchema)
        }),
        z.object({
            type: z.literal("discriminatedUnion"),
            discriminant: PropertyKeySchema,
            variants: z.array(LatestDiscriminatedUnionVariantSchema)
        }),
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(LatestObjectPropertySchema),
            extraProperties: LatestTypeReferenceSchema.nullish()
        })
    ])
);

export const LatestTypeReferenceSchema: z.ZodType<LatestTypeReference> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("id"),
            id: TypeIdSchema,
            default: LatestTypeReferenceIdDefaultSchema.nullish()
        }),
        z.object({
            type: z.literal("primitive"),
            value: LatestPrimitiveTypeSchema
        }),
        z.object({
            type: z.literal("optional"),
            shape: LatestTypeShapeSchema,
            default: z.unknown().nullish()
        }),
        z.object({
            type: z.literal("nullable"),
            shape: LatestTypeShapeSchema
        }),
        z.object({
            type: z.literal("list"),
            itemShape: LatestTypeShapeSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("set"),
            itemShape: LatestTypeShapeSchema,
            minItems: z.number().int().nullish(),
            maxItems: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("map"),
            keyShape: LatestTypeShapeSchema,
            valueShape: LatestTypeShapeSchema,
            minProperties: z.number().int().nullish(),
            maxProperties: z.number().int().nullish()
        }),
        z.object({
            type: z.literal("literal"),
            value: LatestLiteralTypeSchema
        }),
        z.object({
            type: z.literal("unknown"),
            displayName: z.string().nullish()
        })
    ])
);

export const LatestTypeDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    shape: LatestTypeShapeSchema,
    displayName: z.string().nullish()
});
export type LatestTypeDefinition = z.infer<typeof LatestTypeDefinitionSchema>;

export const LatestContentTypeSchema = z.union([z.string(), z.array(z.string())]);
export type LatestContentType = z.infer<typeof LatestContentTypeSchema>;

export const LatestBytesRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    isOptional: z.boolean(),
    contentType: LatestContentTypeSchema.nullish()
});
export type LatestBytesRequest = z.infer<typeof LatestBytesRequestSchema>;

export const LatestFormDataPropertySchema: z.ZodType<LatestFormDataField> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("file"),
            description: z.string().nullish(),
            availability: AvailabilitySchema.nullish(),
            key: PropertyKeySchema,
            isOptional: z.boolean(),
            contentType: LatestContentTypeSchema.nullish()
        }),
        z.object({
            type: z.literal("files"),
            description: z.string().nullish(),
            availability: AvailabilitySchema.nullish(),
            key: PropertyKeySchema,
            isOptional: z.boolean(),
            contentType: LatestContentTypeSchema.nullish()
        }),
        z.object({
            type: z.literal("property"),
            description: z.string().nullish(),
            availability: AvailabilitySchema.nullish(),
            key: PropertyKeySchema,
            valueShape: LatestTypeShapeSchema,
            propertyAccess: LatestObjectPropertyAccessSchema.nullish(),
            contentType: LatestContentTypeSchema.nullish(),
            exploded: z.boolean().nullish()
        })
    ])
);

export type LatestFormDataFile = {
    type: "file";
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    isOptional: boolean;
    contentType?: LatestContentType | null;
};

export type LatestFormDataFiles = {
    type: "files";
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    isOptional: boolean;
    contentType?: LatestContentType | null;
};

export type LatestFormDataPropertyVariant = {
    type: "property";
    description?: string | null;
    availability?: z.infer<typeof AvailabilitySchema> | null;
    key: string;
    valueShape: LatestTypeShape;
    propertyAccess?: LatestObjectPropertyAccess | null;
    contentType?: LatestContentType | null;
    exploded?: boolean | null;
};

export type LatestFormDataField = LatestFormDataFile | LatestFormDataFiles | LatestFormDataPropertyVariant;

export const LatestFormDataRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    fields: z.array(LatestFormDataPropertySchema)
});
export type LatestFormDataRequest = z.infer<typeof LatestFormDataRequestSchema>;

export const LatestNullableTypeSchema: z.ZodType<{ shape: LatestTypeShape }> = z.lazy(() =>
    z.object({
        shape: LatestTypeShapeSchema
    })
);

export const LatestOptionalTypeSchema: z.ZodType<{ shape: LatestTypeShape; default?: unknown }> = z.lazy(() =>
    z.object({
        shape: LatestTypeShapeSchema,
        default: z.unknown().nullish()
    })
);

export const LatestListTypeSchema: z.ZodType<{
    itemShape: LatestTypeShape;
    minItems?: number | null;
    maxItems?: number | null;
}> = z.lazy(() =>
    z.object({
        itemShape: LatestTypeShapeSchema,
        minItems: z.number().int().nullish(),
        maxItems: z.number().int().nullish()
    })
);

export const LatestSetTypeSchema: z.ZodType<{
    itemShape: LatestTypeShape;
    minItems?: number | null;
    maxItems?: number | null;
}> = z.lazy(() =>
    z.object({
        itemShape: LatestTypeShapeSchema,
        minItems: z.number().int().nullish(),
        maxItems: z.number().int().nullish()
    })
);

export const LatestMapTypeSchema: z.ZodType<{
    keyShape: LatestTypeShape;
    valueShape: LatestTypeShape;
    minProperties?: number | null;
    maxProperties?: number | null;
}> = z.lazy(() =>
    z.object({
        keyShape: LatestTypeShapeSchema,
        valueShape: LatestTypeShapeSchema,
        minProperties: z.number().int().nullish(),
        maxProperties: z.number().int().nullish()
    })
);

// ── Latest endpoint ──────────────────────────────────────────────────────

export const LatestLanguageSchema = z.string();
export type LatestLanguage = z.infer<typeof LatestLanguageSchema>;

export const LatestExampleEndpointRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("form"), value: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal("bytes"), value: z.unknown() })
]);
export type LatestExampleEndpointRequest = z.infer<typeof LatestExampleEndpointRequestSchema>;

export const LatestExampleEndpointResponseSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("filename"), value: z.unknown() }),
    z.object({ type: z.literal("stream"), value: z.array(z.unknown()) }),
    z.object({ type: z.literal("sse"), value: z.array(z.object({ event: z.string(), data: z.unknown() })) })
]);
export type LatestExampleEndpointResponse = z.infer<typeof LatestExampleEndpointResponseSchema>;

export const LatestExampleErrorResponseSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() })
]);
export type LatestExampleErrorResponse = z.infer<typeof LatestExampleErrorResponseSchema>;

export const LatestHttpRequestBodyShapeSchema: z.ZodType<LatestHttpRequestBodyShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(LatestObjectPropertySchema),
            extraProperties: LatestTypeReferenceSchema.nullish()
        }),
        z.object({ type: z.literal("alias"), value: LatestTypeReferenceSchema }),
        z.object({ type: z.literal("bytes"), ...LatestBytesRequestSchema.shape }),
        z.object({ type: z.literal("formData"), ...LatestFormDataRequestSchema.shape })
    ])
);

export type LatestHttpRequestBodyShape =
    | ({ type: "object" } & LatestObjectType)
    | { type: "alias"; value: LatestTypeReference }
    | ({ type: "bytes" } & z.infer<typeof LatestBytesRequestSchema>)
    | ({ type: "formData" } & z.infer<typeof LatestFormDataRequestSchema>);

export const LatestHttpRequestSchema = z.object({
    description: z.string().nullish(),
    contentType: z.string().nullish(),
    body: LatestHttpRequestBodyShapeSchema
});
export type LatestHttpRequest = z.infer<typeof LatestHttpRequestSchema>;

export const LatestFileDownloadResponseBodyShapeSchema = z.object({
    contentType: z.string().nullish()
});
export type LatestFileDownloadResponseBodyShape = z.infer<typeof LatestFileDownloadResponseBodyShapeSchema>;

export const LatestStreamResponseSchema = z.object({
    terminator: z.string().nullish(),
    shape: LatestTypeShapeSchema
});
export type LatestStreamResponse = z.infer<typeof LatestStreamResponseSchema>;

export type LatestHttpResponseBodyShape =
    | { type: "empty" }
    | ({ type: "object" } & LatestObjectType)
    | { type: "alias"; value: LatestTypeReference }
    | ({ type: "fileDownload" } & z.infer<typeof LatestFileDownloadResponseBodyShapeSchema>)
    | { type: "streamingText" }
    | ({ type: "stream" } & z.infer<typeof LatestStreamResponseSchema>);

export const LatestHttpResponseBodyShapeSchema: z.ZodType<LatestHttpResponseBodyShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({ type: z.literal("empty") }),
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(LatestObjectPropertySchema),
            extraProperties: LatestTypeReferenceSchema.nullish()
        }),
        z.object({ type: z.literal("alias"), value: LatestTypeReferenceSchema }),
        z.object({ type: z.literal("fileDownload"), ...LatestFileDownloadResponseBodyShapeSchema.shape }),
        z.object({ type: z.literal("streamingText") }),
        z.object({ type: z.literal("stream"), ...LatestStreamResponseSchema.shape })
    ])
);

export const LatestHttpResponseSchema = z.object({
    description: z.string().nullish(),
    body: LatestHttpResponseBodyShapeSchema,
    statusCode: z.number().int(),
    isWildcard: z.boolean().nullish()
});
export type LatestHttpResponse = z.infer<typeof LatestHttpResponseSchema>;

export const LatestErrorExampleSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    responseBody: LatestExampleErrorResponseSchema
});
export type LatestErrorExample = z.infer<typeof LatestErrorExampleSchema>;

export const LatestErrorResponseSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    shape: LatestTypeShapeSchema.nullish(),
    statusCode: z.number().int(),
    isWildcard: z.boolean().nullish(),
    name: z.string(),
    examples: z.array(LatestErrorExampleSchema).nullish(),
    headers: z.array(LatestObjectPropertySchema).nullish()
});
export type LatestErrorResponse = z.infer<typeof LatestErrorResponseSchema>;

export const LatestCodeSnippetSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    language: LatestLanguageSchema,
    install: z.string().nullish(),
    code: z.string(),
    generated: z.boolean()
});
export type LatestCodeSnippet = z.infer<typeof LatestCodeSnippetSchema>;

export const LatestExampleEndpointCallSchema = z.object({
    description: z.string().nullish(),
    path: z.string(),
    responseStatusCode: z.number().int(),
    name: z.string().nullish(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    queryParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    headers: z.record(PropertyKeySchema, z.unknown()).nullish(),
    requestBody: LatestExampleEndpointRequestSchema.nullish(),
    responseBody: LatestExampleEndpointResponseSchema.nullish(),
    snippets: z.record(LatestLanguageSchema, z.array(LatestCodeSnippetSchema)).nullish(),
    codeExamples: z.unknown().nullish(),
    codeSamples: z.array(LatestCodeSnippetSchema).nullish()
});
export type LatestExampleEndpointCall = z.infer<typeof LatestExampleEndpointCallSchema>;

export const LatestEndpointDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    namespace: z.array(z.string()).nullish(),
    id: EndpointIdSchema,
    method: HttpMethodSchema,
    path: z.array(PathPartSchema),
    displayName: z.string().nullish(),
    operationId: z.string().nullish(),
    auth: z.array(AuthSchemeIdSchema).nullish(),
    multiAuth: z.array(MultipleAuthTypeSchema).nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema).nullish(),
    pathParameters: z.array(LatestParameterPropertySchema).nullish(),
    queryParameters: z.array(LatestParameterPropertySchema).nullish(),
    requestHeaders: z.array(LatestObjectPropertySchema).nullish(),
    responseHeaders: z.array(LatestObjectPropertySchema).nullish(),
    requests: z.array(LatestHttpRequestSchema).nullish(),
    responses: z.array(LatestHttpResponseSchema).nullish(),
    errors: z.array(LatestErrorResponseSchema).nullish(),
    examples: z.array(LatestExampleEndpointCallSchema).nullish(),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish(),
    snippetTemplates: z.unknown().nullish()
});
export type LatestEndpointDefinition = z.infer<typeof LatestEndpointDefinitionSchema>;

// ── Latest graphql ───────────────────────────────────────────────────────

export const LatestGraphQlOperationTypeSchema = z.enum(["QUERY", "MUTATION", "SUBSCRIPTION"]);
export type LatestGraphQlOperationType = z.infer<typeof LatestGraphQlOperationTypeSchema>;

export const LatestGraphQlArgumentSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    type: LatestTypeShapeSchema,
    defaultValue: z.unknown().nullish()
});
export type LatestGraphQlArgument = z.infer<typeof LatestGraphQlArgumentSchema>;

export const LatestGraphQlExampleSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    query: z.string(),
    variables: z.record(z.string(), z.unknown()).nullish(),
    response: z.unknown().nullish()
});
export type LatestGraphQlExample = z.infer<typeof LatestGraphQlExampleSchema>;

export const LatestGraphQlOperationSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    namespace: z.array(z.string()).nullish(),
    id: GraphQlOperationIdSchema,
    operationType: LatestGraphQlOperationTypeSchema,
    name: z.string(),
    displayName: z.string().nullish(),
    arguments: z.array(LatestGraphQlArgumentSchema).nullish(),
    returnType: LatestTypeShapeSchema,
    examples: z.array(LatestGraphQlExampleSchema).nullish(),
    snippets: z.record(LatestLanguageSchema, z.array(LatestCodeSnippetSchema)).nullish()
});
export type LatestGraphQlOperation = z.infer<typeof LatestGraphQlOperationSchema>;

// ── Latest webhook ───────────────────────────────────────────────────────

export type LatestWebhookPayloadShape =
    | ({ type: "object" } & LatestObjectType)
    | { type: "alias"; value: LatestTypeReference }
    | ({ type: "formData" } & z.infer<typeof LatestFormDataRequestSchema>);

export const LatestWebhookPayloadShapeSchema: z.ZodType<LatestWebhookPayloadShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(LatestObjectPropertySchema),
            extraProperties: LatestTypeReferenceSchema.nullish()
        }),
        z.object({ type: z.literal("alias"), value: LatestTypeReferenceSchema }),
        z.object({ type: z.literal("formData"), ...LatestFormDataRequestSchema.shape })
    ])
);

export const LatestWebhookPayloadSchema = z.object({
    description: z.string().nullish(),
    shape: LatestWebhookPayloadShapeSchema
});
export type LatestWebhookPayload = z.infer<typeof LatestWebhookPayloadSchema>;

export const LatestExampleWebhookPayloadSchema = z.object({
    name: z.string().nullish(),
    payload: z.unknown()
});
export type LatestExampleWebhookPayload = z.infer<typeof LatestExampleWebhookPayloadSchema>;

export const LatestWebhookDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    namespace: z.array(z.string()).nullish(),
    id: WebhookIdSchema,
    displayName: z.string().nullish(),
    operationId: z.string().nullish(),
    method: WebhookHttpMethodSchema,
    path: z.array(z.string()),
    headers: z.array(LatestObjectPropertySchema).nullish(),
    payloads: z.array(LatestWebhookPayloadSchema).nullish(),
    responses: z.array(LatestHttpResponseSchema).nullish(),
    examples: z.array(LatestExampleWebhookPayloadSchema).nullish()
});
export type LatestWebhookDefinition = z.infer<typeof LatestWebhookDefinitionSchema>;

// ── Latest websocket ─────────────────────────────────────────────────────

export const LatestWebSocketMessageSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: WebSocketMessageIdSchema,
    displayName: z.string().nullish(),
    origin: WebSocketMessageOriginSchema,
    body: LatestTypeShapeSchema
});
export type LatestWebSocketMessage = z.infer<typeof LatestWebSocketMessageSchema>;

export const LatestExampleWebSocketMessageSchema = z.object({
    type: WebSocketMessageIdSchema,
    body: z.unknown()
});
export type LatestExampleWebSocketMessage = z.infer<typeof LatestExampleWebSocketMessageSchema>;

export const LatestExampleWebSocketSessionSchema = z.object({
    description: z.string().nullish(),
    path: z.string(),
    name: z.string().nullish(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    queryParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    requestHeaders: z.record(PropertyKeySchema, z.unknown()).nullish(),
    messages: z.array(LatestExampleWebSocketMessageSchema).nullish()
});
export type LatestExampleWebSocketSession = z.infer<typeof LatestExampleWebSocketSessionSchema>;

export const LatestWebSocketChannelSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    namespace: z.array(z.string()).nullish(),
    id: WebSocketIdSchema,
    displayName: z.string().nullish(),
    operationId: z.string().nullish(),
    path: z.array(PathPartSchema),
    messages: z.array(LatestWebSocketMessageSchema),
    auth: z.array(AuthSchemeIdSchema).nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema).nullish(),
    pathParameters: z.array(LatestParameterPropertySchema).nullish(),
    queryParameters: z.array(LatestParameterPropertySchema).nullish(),
    requestHeaders: z.array(LatestObjectPropertySchema).nullish(),
    examples: z.array(LatestExampleWebSocketSessionSchema).nullish()
});
export type LatestWebSocketChannel = z.infer<typeof LatestWebSocketChannelSchema>;

// ── Latest SubpackageMetadata & ApiDefinition ────────────────────────────

export const LatestSubpackageMetadataSchema = z.object({
    id: SubpackageIdSchema,
    name: z.string(),
    displayName: z.string().nullish()
});
export type LatestSubpackageMetadata = z.infer<typeof LatestSubpackageMetadataSchema>;

// Import SnippetsConfigSchema from contract-register
import { SnippetsConfigSchema } from "./contract-register.js";

export const LatestApiDefinitionSchema = z.object({
    id: z.string(),
    apiName: z.string().nullish(),
    endpoints: z.record(EndpointIdSchema, LatestEndpointDefinitionSchema),
    websockets: z.record(WebSocketIdSchema, LatestWebSocketChannelSchema),
    webhooks: z.record(WebhookIdSchema, LatestWebhookDefinitionSchema),
    graphqlOperations: z.record(GraphQlOperationIdSchema, LatestGraphQlOperationSchema),
    types: z.record(TypeIdSchema, LatestTypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, LatestSubpackageMetadataSchema),
    auths: z.record(AuthSchemeIdSchema, LatestAuthSchemeSchema),
    globalHeaders: z.array(LatestObjectPropertySchema).nullish(),
    snippetsConfiguration: SnippetsConfigSchema.nullish()
});
export type LatestApiDefinition = z.infer<typeof LatestApiDefinitionSchema>;

// Alias for backward compatibility (consumers use FdrAPI.api.latest.ApiDefinition)
export type ApiDefinition = LatestApiDefinition;
export const ApiDefinitionSchema = LatestApiDefinitionSchema;
