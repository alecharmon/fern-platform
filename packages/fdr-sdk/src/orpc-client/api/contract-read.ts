import * as z from "zod";
import { SnippetsConfigSchema } from "./contract-register.js";

import type { DiscriminatedUnionType, EnumType, ObjectType, TypeReference } from "./shared.js";
import {
    ApiAuthSchema,
    ApiDefinitionIdSchema,
    ApiNavigationConfigRootSchema,
    AuthSchemeIdSchema,
    AvailabilitySchema,
    DiscriminatedUnionTypeSchema,
    EndpointIdSchema,
    EndpointPathSchema,
    EnumTypeSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    ErrorDeclarationSchema,
    ErrorExampleSchema,
    ExampleEndpointRequestSchema,
    ExampleEndpointResponseSchema,
    ExampleWebhookPayloadSchema,
    ExampleWebSocketSessionSchema,
    FileDownloadResponseBodyShapeSchema,
    FormDataRequestSchema,
    GraphQlOperationSchema,
    HeaderSchema,
    HttpMethodSchema,
    JsonBodyShapeSchema,
    MultipleAuthTypeSchema,
    ObjectTypeSchema,
    PropertyKeySchema,
    ProtocolSchema,
    QueryParameterSchema,
    StreamConditionSchema,
    StreamResponseV2Schema,
    SubpackageIdSchema,
    TypeIdSchema,
    TypeReferenceSchema,
    WebhookHttpMethodSchema,
    WebhookIdSchema,
    WebhookPayloadSchema,
    WebSocketIdSchema,
    WebSocketMessageSchema
} from "./shared.js";

// ── Read type ────────────────────────────────────────────────────────────

export const ReadUndiscriminatedUnionVariantSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    displayName: z.string().optional(),
    type: TypeReferenceSchema
});
export type ReadUndiscriminatedUnionVariant = z.infer<typeof ReadUndiscriminatedUnionVariantSchema>;

export const ReadUndiscriminatedUnionTypeSchema = z.object({
    variants: z.array(ReadUndiscriminatedUnionVariantSchema)
});
export type ReadUndiscriminatedUnionType = z.infer<typeof ReadUndiscriminatedUnionTypeSchema>;

export type ReadTypeShape =
    | ReadTypeShape.Alias
    | ReadTypeShape.Enum
    | ReadTypeShape.UndiscriminatedUnion
    | ReadTypeShape.DiscriminatedUnion
    | ReadTypeShape.Object_;

export namespace ReadTypeShape {
    export interface Alias {
        type: "alias";
        value: TypeReference;
    }
    export interface Enum extends EnumType {
        type: "enum";
    }
    export interface UndiscriminatedUnion extends ReadUndiscriminatedUnionType {
        type: "undiscriminatedUnion";
    }
    export interface DiscriminatedUnion extends DiscriminatedUnionType {
        type: "discriminatedUnion";
    }
    export interface Object_ extends ObjectType {
        type: "object";
    }
}

export const ReadTypeShapeSchema: z.ZodType<ReadTypeShape> = z.lazy(() =>
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
            ...ReadUndiscriminatedUnionTypeSchema.shape
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

export const ReadTypeDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    name: z.string(),
    shape: ReadTypeShapeSchema,
    displayName: z.string().optional()
});
export type ReadTypeDefinition = z.infer<typeof ReadTypeDefinitionSchema>;

export const ReadBytesRequestSchema = z.object({
    isOptional: z.boolean(),
    contentType: z.string().optional()
});
export type ReadBytesRequest = z.infer<typeof ReadBytesRequestSchema>;

// ── Read endpoint ────────────────────────────────────────────────────────

export const ReadHttpRequestBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("bytes"), ...ReadBytesRequestSchema.shape }),
    z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape }),
    z.object({ type: z.literal("fileUpload"), value: FormDataRequestSchema.optional() })
]);
export type ReadHttpRequestBodyShape = z.infer<typeof ReadHttpRequestBodyShapeSchema>;

export const ReadHttpRequestSchema = z.object({
    description: z.string().optional(),
    contentType: z.string(),
    type: ReadHttpRequestBodyShapeSchema
});
export type ReadHttpRequest = z.infer<typeof ReadHttpRequestSchema>;

export const ReadHttpRequestsV2Schema = z.object({
    requests: z.array(ReadHttpRequestSchema).optional()
});
export type ReadHttpRequestsV2 = z.infer<typeof ReadHttpRequestsV2Schema>;

export const ReadSupportedLanguageSchema = z.enum([
    "curl",
    "python",
    "javascript",
    "js",
    "node",
    "typescript",
    "ts",
    "go",
    "ruby",
    "csharp",
    "php",
    "swift",
    "rust"
]);
export type ReadSupportedLanguage = z.infer<typeof ReadSupportedLanguageSchema>;

export const ReadLanguageSchema = z.union([ReadSupportedLanguageSchema, z.string()]);
export type ReadLanguage = z.infer<typeof ReadLanguageSchema>;

export const ReadCustomCodeSampleSchema = z.object({
    description: z.string().optional(),
    language: ReadLanguageSchema,
    code: z.string(),
    name: z.string().optional(),
    install: z.string().optional()
});
export type ReadCustomCodeSample = z.infer<typeof ReadCustomCodeSampleSchema>;

export const ReadPythonSnippetSchema = z.object({
    async_client: z.string(),
    sync_client: z.string(),
    install: z.string().optional()
});
export type ReadPythonSnippet = z.infer<typeof ReadPythonSnippetSchema>;

export const ReadTypescriptSnippetSchema = z.object({
    client: z.string(),
    install: z.string().optional()
});
export type ReadTypescriptSnippet = z.infer<typeof ReadTypescriptSnippetSchema>;

export const ReadGoSnippetSchema = z.object({
    client: z.string(),
    install: z.string().optional()
});
export type ReadGoSnippet = z.infer<typeof ReadGoSnippetSchema>;

export const ReadRubySnippetSchema = z.object({
    client: z.string(),
    install: z.string().optional()
});
export type ReadRubySnippet = z.infer<typeof ReadRubySnippetSchema>;

export const ReadCsharpSnippetSchema = z.object({
    client: z.string(),
    install: z.string().optional()
});
export type ReadCsharpSnippet = z.infer<typeof ReadCsharpSnippetSchema>;

export const ReadCodeExamplesSchema = z.object({
    nodeAxios: z.string().optional(),
    pythonSdk: ReadPythonSnippetSchema.optional(),
    typescriptSdk: ReadTypescriptSnippetSchema.optional(),
    goSdk: ReadGoSnippetSchema.optional(),
    rubySdk: ReadRubySnippetSchema.optional(),
    csharpSdk: ReadCsharpSnippetSchema.optional()
});
export type ReadCodeExamples = z.infer<typeof ReadCodeExamplesSchema>;

export const ReadExampleEndpointCallSchema = z.object({
    description: z.string().optional(),
    name: z.string().optional(),
    path: z.string(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()),
    queryParameters: z.record(z.string(), z.unknown()),
    headers: z.record(z.string(), z.unknown()),
    requestBody: z.unknown(),
    requestBodyV3: ExampleEndpointRequestSchema.optional(),
    responseStatusCode: z.number().int(),
    responseBody: z.unknown(),
    responseBodyV3: ExampleEndpointResponseSchema.optional(),
    codeExamples: ReadCodeExamplesSchema,
    codeSamples: z.array(ReadCustomCodeSampleSchema)
});
export type ReadExampleEndpointCall = z.infer<typeof ReadExampleEndpointCallSchema>;

export const ReadNonStreamResponseSchema = z.object({
    shape: JsonBodyShapeSchema,
    examples: z.array(ReadExampleEndpointCallSchema)
});
export type ReadNonStreamResponse = z.infer<typeof ReadNonStreamResponseSchema>;

export const ReadStreamResponseSchema = z.object({
    shape: JsonBodyShapeSchema,
    examples: z.array(ReadExampleEndpointCallSchema)
});
export type ReadStreamResponse = z.infer<typeof ReadStreamResponseSchema>;

export const ReadStreamConditionResponseSchema = z.object({
    response: ReadNonStreamResponseSchema,
    streamResponse: ReadStreamResponseSchema,
    streamCondition: StreamConditionSchema
});
export type ReadStreamConditionResponse = z.infer<typeof ReadStreamConditionResponseSchema>;

export const ReadHttpResponseBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("fileDownload"), ...FileDownloadResponseBodyShapeSchema.shape }),
    z.object({ type: z.literal("streamingText") }),
    z.object({ type: z.literal("stream"), ...StreamResponseV2Schema.shape }),
    z.object({ type: z.literal("streamCondition"), ...ReadStreamConditionResponseSchema.shape })
]);
export type ReadHttpResponseBodyShape = z.infer<typeof ReadHttpResponseBodyShapeSchema>;

export const ReadHttpResponseSchema = z.object({
    description: z.string().optional(),
    type: ReadHttpResponseBodyShapeSchema,
    statusCode: z.number().int().optional(),
    isWildcard: z.boolean().optional()
});
export type ReadHttpResponse = z.infer<typeof ReadHttpResponseSchema>;

export const ReadHttpResponsesV2Schema = z.object({
    responses: z.array(ReadHttpResponseSchema).optional()
});
export type ReadHttpResponsesV2 = z.infer<typeof ReadHttpResponsesV2Schema>;

export const ReadErrorDeclarationV2Schema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    type: ReadTypeShapeSchema.optional(),
    statusCode: z.number().int(),
    isWildcard: z.boolean().optional(),
    name: z.string().optional(),
    examples: z.array(ErrorExampleSchema).optional(),
    headers: z.array(HeaderSchema).optional()
});
export type ReadErrorDeclarationV2 = z.infer<typeof ReadErrorDeclarationV2Schema>;

export const ReadEndpointDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    authed: z.boolean(),
    authV2: z.array(AuthSchemeIdSchema).optional(),
    multiAuth: z.array(MultipleAuthTypeSchema).optional(),
    defaultEnvironment: EnvironmentIdSchema.optional(),
    environments: z.array(EnvironmentSchema),
    method: HttpMethodSchema,
    id: EndpointIdSchema,
    originalEndpointId: z.string().optional(),
    urlSlug: z.string(),
    migratedFromUrlSlugs: z.array(z.string()).optional(),
    name: z.string().optional(),
    path: EndpointPathSchema,
    queryParameters: z.array(QueryParameterSchema),
    headers: z.array(HeaderSchema),
    responseHeaders: z.array(HeaderSchema).optional(),
    request: ReadHttpRequestSchema.optional(),
    requestsV2: ReadHttpRequestsV2Schema.optional(),
    response: ReadHttpResponseSchema.optional(),
    responsesV2: ReadHttpResponsesV2Schema.optional(),
    errors: z.array(ErrorDeclarationSchema),
    errorsV2: z.array(ReadErrorDeclarationV2Schema).optional(),
    examples: z.array(ReadExampleEndpointCallSchema),
    protocol: ProtocolSchema.optional(),
    includeInApiExplorer: z.boolean().optional()
});
export type ReadEndpointDefinition = z.infer<typeof ReadEndpointDefinitionSchema>;

// ── Read webhook ─────────────────────────────────────────────────────────

export const ReadWebhookDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    urlSlug: z.string(),
    migratedFromUrlSlugs: z.array(z.string()).optional(),
    method: WebhookHttpMethodSchema,
    id: WebhookIdSchema,
    name: z.string().optional(),
    path: z.array(z.string()),
    headers: z.array(HeaderSchema),
    payload: WebhookPayloadSchema,
    responses: z.array(ReadHttpResponseSchema).optional(),
    examples: z.array(ExampleWebhookPayloadSchema)
});
export type ReadWebhookDefinition = z.infer<typeof ReadWebhookDefinitionSchema>;

// ── Read websocket ───────────────────────────────────────────────────────

export const ReadWebSocketChannelSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    urlSlug: z.string(),
    id: WebSocketIdSchema,
    auth: z.boolean(),
    name: z.string().optional(),
    defaultEnvironment: EnvironmentIdSchema.optional(),
    environments: z.array(EnvironmentSchema),
    path: EndpointPathSchema,
    headers: z.array(HeaderSchema),
    queryParameters: z.array(QueryParameterSchema),
    messages: z.array(WebSocketMessageSchema),
    examples: z.array(ExampleWebSocketSessionSchema)
});
export type ReadWebSocketChannel = z.infer<typeof ReadWebSocketChannelSchema>;

// ── Read ApiDefinition ───────────────────────────────────────────────────

export const ReadApiDefinitionPackageSchema = z.object({
    endpoints: z.array(ReadEndpointDefinitionSchema),
    websockets: z.array(ReadWebSocketChannelSchema),
    webhooks: z.array(ReadWebhookDefinitionSchema),
    graphqlOperations: z.array(GraphQlOperationSchema),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.optional()
});
export type ReadApiDefinitionPackage = z.infer<typeof ReadApiDefinitionPackageSchema>;

export const ReadApiDefinitionSubpackageSchema = z.object({
    description: z.string().optional(),
    ...ReadApiDefinitionPackageSchema.shape,
    parent: SubpackageIdSchema.optional(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    urlSlug: z.string(),
    displayName: z.string().optional()
});
export type ReadApiDefinitionSubpackage = z.infer<typeof ReadApiDefinitionSubpackageSchema>;

export const ReadApiDefinitionSchema = z.object({
    id: ApiDefinitionIdSchema,
    apiName: z.string().optional(),
    rootPackage: ReadApiDefinitionPackageSchema,
    types: z.record(TypeIdSchema, ReadTypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, ReadApiDefinitionSubpackageSchema),
    snippetsConfiguration: SnippetsConfigSchema.optional(),
    auth: ApiAuthSchema.optional(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).optional(),
    hasMultipleBaseUrls: z.boolean().optional(),
    navigation: ApiNavigationConfigRootSchema.optional(),
    globalHeaders: z.array(HeaderSchema).optional()
});
export type ReadApiDefinition = z.infer<typeof ReadApiDefinitionSchema>;
