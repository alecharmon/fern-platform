import * as z from "zod";
import { ApiDefinitionIdSchema, HttpMethod, HttpMethodSchema } from "../shared.js";

export { ApiDefinitionIdSchema, HttpMethod, HttpMethodSchema };

export const TypeIdSchema = z.string();
export type TypeId = z.infer<typeof TypeIdSchema>;
export function TypeId(value: string): TypeId {
    return value;
}

export const EndpointIdSchema = z.string();
export type EndpointId = z.infer<typeof EndpointIdSchema>;
export function EndpointId(value: string): EndpointId {
    return value;
}

export const WebSocketIdSchema = z.string();
export type WebSocketId = z.infer<typeof WebSocketIdSchema>;
export function WebSocketId(value: string): WebSocketId {
    return value;
}

export const WebhookIdSchema = z.string();
export type WebhookId = z.infer<typeof WebhookIdSchema>;
export function WebhookId(value: string): WebhookId {
    return value;
}

export const GraphQlOperationIdSchema = z.string();
export type GraphQlOperationId = z.infer<typeof GraphQlOperationIdSchema>;
export function GraphQlOperationId(value: string): GraphQlOperationId {
    return value;
}

export const EnvironmentIdSchema = z.string();
export type EnvironmentId = z.infer<typeof EnvironmentIdSchema>;
export function EnvironmentId(value: string): EnvironmentId {
    return value;
}

export const PropertyKeySchema = z.string();
export type PropertyKey = z.infer<typeof PropertyKeySchema>;
export function PropertyKey(value: string): PropertyKey {
    return value;
}

export const AuthSchemeIdSchema = z.string();
export type AuthSchemeId = z.infer<typeof AuthSchemeIdSchema>;
export function AuthSchemeId(value: string): AuthSchemeId {
    return value;
}

export const SubpackageIdSchema = z.string();
export type SubpackageId = z.infer<typeof SubpackageIdSchema>;
export function SubpackageId(value: string): SubpackageId {
    return value;
}

export const WebSocketMessageIdSchema = z.string();
export type WebSocketMessageId = z.infer<typeof WebSocketMessageIdSchema>;
export function WebSocketMessageId(value: string): WebSocketMessageId {
    return value;
}

export const FileIdSchema: z.ZodType<FileId> = z.string() as any;
export type FileId = string & { FileId: void };
export function FileId(value: string): FileId {
    return value as unknown as FileId;
}

export const MultipleAuthTypeSchema = z.object({
    schemes: z.array(AuthSchemeIdSchema)
});
export type MultipleAuthType = z.infer<typeof MultipleAuthTypeSchema>;

export const GrpcMethodSchema = z.enum(["UNARY", "CLIENT_STREAM", "SERVER_STREAM", "BIDIRECTIONAL_STREAM"]);

export const AvailabilitySchema = z.enum([
    "Stable",
    "GenerallyAvailable",
    "InDevelopment",
    "PreRelease",
    "Deprecated",
    "Beta"
]);

export const WebSocketMessageOriginSchema = z.enum(["client", "server"]);
export type WebSocketMessageOrigin = z.infer<typeof WebSocketMessageOriginSchema>;

export const WebhookHttpMethodSchema = z.enum(["GET", "POST"]);
export type WebhookHttpMethod = z.infer<typeof WebhookHttpMethodSchema>;

export const WithDescriptionSchema = z.object({
    description: z.string().nullish()
});
export type WithDescription = z.infer<typeof WithDescriptionSchema>;

export const WithAvailabilitySchema = z.object({
    availability: AvailabilitySchema.nullish()
});
export type WithAvailability = z.infer<typeof WithAvailabilitySchema>;

export const EnvironmentSchema = z.object({
    id: EnvironmentIdSchema,
    baseUrl: z.string(),
    audiences: z.array(z.string()).nullish()
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const RestProtocolSchema = z.object({});

export const OpenRpcProtocolSchema = z.object({
    methodName: z.string()
});

export const GrpcProtocolSchema = z.object({
    methodName: z.string(),
    methodType: GrpcMethodSchema.nullish()
});

export const ProtocolSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("rest"), ...RestProtocolSchema.shape }),
    z.object({ type: z.literal("openrpc"), ...OpenRpcProtocolSchema.shape }),
    z.object({ type: z.literal("grpc"), ...GrpcProtocolSchema.shape })
]);
export type Protocol = z.infer<typeof ProtocolSchema>;

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

export const EndpointPathPartSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("literal"), value: z.string() }),
    z.object({ type: z.literal("pathParameter"), value: PropertyKeySchema })
]);
export type EndpointPathPart = z.infer<typeof EndpointPathPartSchema>;

export const PathParameterSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    key: PropertyKeySchema,
    type: TypeReferenceSchema,
    explode: z.boolean().nullish()
});
export type PathParameter = z.infer<typeof PathParameterSchema>;

export const EndpointPathSchema = z.object({
    parts: z.array(EndpointPathPartSchema),
    pathParameters: z.array(PathParameterSchema)
});
export type EndpointPath = z.infer<typeof EndpointPathSchema>;

export const QueryParameterSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    key: z.string(),
    type: TypeReferenceSchema,
    explode: z.boolean().nullish()
});
export type QueryParameter = z.infer<typeof QueryParameterSchema>;

export const HeaderSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    key: z.string(),
    type: TypeReferenceSchema
});
export type Header = z.infer<typeof HeaderSchema>;

export const JsonBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema })
]);
export type JsonBodyShape = z.infer<typeof JsonBodyShapeSchema>;

export const FileDownloadResponseBodyShapeSchema = z.object({
    contentType: z.string().nullish()
});
export type FileDownloadResponseBodyShape = z.infer<typeof FileDownloadResponseBodyShapeSchema>;

export const StreamResponseV2Schema = z.object({
    terminator: z.string().nullish(),
    shape: JsonBodyShapeSchema
});
export type StreamResponseV2 = z.infer<typeof StreamResponseV2Schema>;

export const StreamConditionSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("booleanRequestProperty"), value: PropertyKeySchema })
]);
export type StreamCondition = z.infer<typeof StreamConditionSchema>;

export const FilenameWithDataSchema = z.object({
    filename: z.string(),
    data: FileIdSchema
});
export type FilenameWithData = z.infer<typeof FilenameWithDataSchema>;

export const FormValueSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("filename"), value: z.string() }),
    z.object({ type: z.literal("filenames"), value: z.array(z.string()) }),
    z.object({ type: z.literal("filenameWithData"), ...FilenameWithDataSchema.shape }),
    z.object({ type: z.literal("filenamesWithData"), value: z.array(FilenameWithDataSchema) }),
    z.object({ type: z.literal("exploded"), value: z.array(z.unknown()) })
]);
export type FormValue = z.infer<typeof FormValueSchema>;

export const BytesValueSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("base64"), value: z.string() })
]);
export type BytesValue = z.infer<typeof BytesValueSchema>;

// The form variant uses z.unknown() for record values instead of FormValueSchema to be
// forward-compatible with new form value types and to tolerate form values produced by
// the AI example enhancer (which may not conform to the strict FormValueSchema).
// Example data is display-only and does not require strict validation at registration time.
export const ExampleEndpointRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("form"), value: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal("bytes"), value: BytesValueSchema })
]);
export type ExampleEndpointRequest = z.infer<typeof ExampleEndpointRequestSchema>;

export const ExampleServerSentEventSchema = z.object({
    event: z.string(),
    data: z.unknown()
});
export type ExampleServerSentEvent = z.infer<typeof ExampleServerSentEventSchema>;

export const ExampleEndpointResponseSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("filename"), value: z.string() }),
    z.object({ type: z.literal("stream"), value: z.array(z.unknown()) }),
    z.object({ type: z.literal("sse"), value: z.array(ExampleServerSentEventSchema) })
]);
export type ExampleEndpointResponse = z.infer<typeof ExampleEndpointResponseSchema>;

export const ErrorDeclarationSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: TypeReferenceSchema.nullish(),
    statusCode: z.number().int()
});
export type ErrorDeclaration = z.infer<typeof ErrorDeclarationSchema>;

export const ExampleErrorResponseSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() })
]);
export type ExampleErrorResponse = z.infer<typeof ExampleErrorResponseSchema>;

export const ErrorExampleSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    responseBody: ExampleErrorResponseSchema
});
export type ErrorExample = z.infer<typeof ErrorExampleSchema>;

export const GraphQlOperationTypeSchema = z.enum(["QUERY", "MUTATION", "SUBSCRIPTION"]);
export type GraphQlOperationType = z.infer<typeof GraphQlOperationTypeSchema>;

export const GraphQlArgumentSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    type: TypeReferenceSchema,
    defaultValue: z.unknown().nullish()
});
export type GraphQlArgument = z.infer<typeof GraphQlArgumentSchema>;

export const GraphQlExampleSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    query: z.string(),
    variables: z.record(z.string(), z.unknown()).nullish(),
    response: z.unknown().nullish()
});
export type GraphQlExample = z.infer<typeof GraphQlExampleSchema>;

export const CodeSnippetSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    language: z.string(),
    install: z.string().nullish(),
    code: z.string(),
    generated: z.boolean()
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const GraphQlOperationSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    id: GraphQlOperationIdSchema,
    operationType: GraphQlOperationTypeSchema,
    name: z.string(),
    displayName: z.string().nullish(),
    arguments: z.array(GraphQlArgumentSchema).nullish(),
    returnType: TypeReferenceSchema,
    examples: z.array(GraphQlExampleSchema).nullish(),
    snippets: z.record(z.string(), z.array(CodeSnippetSchema)).nullish()
});
export type GraphQlOperation = z.infer<typeof GraphQlOperationSchema>;

export const WebhookPayloadShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape })
]);
export type WebhookPayloadShape = z.infer<typeof WebhookPayloadShapeSchema>;

export const WebhookPayloadSchema = z.object({
    description: z.string().nullish(),
    type: WebhookPayloadShapeSchema
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export const ExampleWebhookPayloadSchema = z.object({
    name: z.string().nullish(),
    payload: z.unknown()
});
export type ExampleWebhookPayload = z.infer<typeof ExampleWebhookPayloadSchema>;

export const WebSocketMessageBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema })
]);
export type WebSocketMessageBodyShape = z.infer<typeof WebSocketMessageBodyShapeSchema>;

export const WebSocketMessageSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: WebSocketMessageIdSchema,
    displayName: z.string().nullish(),
    origin: WebSocketMessageOriginSchema,
    body: WebSocketMessageBodyShapeSchema
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export const ExampleWebSocketMessageSchema = z.object({
    type: WebSocketMessageIdSchema,
    body: z.unknown()
});
export type ExampleWebSocketMessage = z.infer<typeof ExampleWebSocketMessageSchema>;

export const ExampleWebSocketSessionSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    path: z.string(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()),
    queryParameters: z.record(z.string(), z.unknown()),
    headers: z.record(z.string(), z.unknown()),
    messages: z.array(ExampleWebSocketMessageSchema)
});
export type ExampleWebSocketSession = z.infer<typeof ExampleWebSocketSessionSchema>;

export type ApiNavigationConfigItem =
    | ApiNavigationConfigItem.Subpackage
    | ApiNavigationConfigItem.EndpointId
    | ApiNavigationConfigItem.WebsocketId
    | ApiNavigationConfigItem.WebhookId
    | ApiNavigationConfigItem.GraphqlOperationId;

export namespace ApiNavigationConfigItem {
    export interface Subpackage {
        type: "subpackage";
        subpackageId: string;
        items: ApiNavigationConfigItem[];
    }
    export interface EndpointId {
        type: "endpointId";
        value: string;
    }
    export interface WebsocketId {
        type: "websocketId";
        value: string;
    }
    export interface WebhookId {
        type: "webhookId";
        value: string;
    }
    export interface GraphqlOperationId {
        type: "graphqlOperationId";
        value: string;
    }
}

export const ApiNavigationConfigItemSchema: z.ZodType<ApiNavigationConfigItem> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("subpackage"),
            subpackageId: SubpackageIdSchema,
            items: z.array(ApiNavigationConfigItemSchema)
        }),
        z.object({ type: z.literal("endpointId"), value: EndpointIdSchema }),
        z.object({ type: z.literal("websocketId"), value: WebSocketIdSchema }),
        z.object({ type: z.literal("webhookId"), value: WebhookIdSchema }),
        z.object({ type: z.literal("graphqlOperationId"), value: GraphQlOperationIdSchema })
    ])
);

export const ApiNavigationConfigRootSchema = z.object({
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigRoot = z.infer<typeof ApiNavigationConfigRootSchema>;

export const BearerAuthSchema = z.object({
    description: z.string().nullish(),
    tokenName: z.string().nullish()
});
export type BearerAuth = z.infer<typeof BearerAuthSchema>;

export const BasicAuthSchema = z.object({
    description: z.string().nullish(),
    usernameName: z.string().nullish(),
    passwordName: z.string().nullish(),
    passwordAlwaysEmpty: z.boolean().nullish()
});
export type BasicAuth = z.infer<typeof BasicAuthSchema>;

export const HeaderAuthSchema = z.object({
    description: z.string().nullish(),
    nameOverride: z.string().nullish(),
    headerWireValue: z.string(),
    prefix: z.string().nullish()
});
export type HeaderAuth = z.infer<typeof HeaderAuthSchema>;

export const OAuthClientCredentialsReferencedEndpointSchema = z.object({
    description: z.string().nullish(),
    endpointId: EndpointIdSchema,
    accessTokenLocator: z.string(),
    headerName: z.string().nullish(),
    tokenPrefix: z.string().nullish()
});
export type OAuthClientCredentialsReferencedEndpoint = z.infer<typeof OAuthClientCredentialsReferencedEndpointSchema>;

export const OAuthClientCredentialsSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("referencedEndpoint"),
        ...OAuthClientCredentialsReferencedEndpointSchema.shape
    })
]);
export type OAuthClientCredentials = z.infer<typeof OAuthClientCredentialsSchema>;

export const OAuthSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("clientCredentials"), value: OAuthClientCredentialsSchema })
]);
export type OAuth = z.infer<typeof OAuthSchema>;

export const ApiAuthSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearerAuth"), ...BearerAuthSchema.shape }),
    z.object({ type: z.literal("basicAuth"), ...BasicAuthSchema.shape }),
    z.object({ type: z.literal("header"), ...HeaderAuthSchema.shape }),
    z.object({ type: z.literal("oAuth"), value: OAuthSchema })
]);
export type ApiAuth = z.infer<typeof ApiAuthSchema>;
