import * as z from "zod";
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

// ── Register commons ─────────────────────────────────────────────────────

export const JqStringSchema = z.string();
export type JqString = z.infer<typeof JqStringSchema>;

export const RegisterLanguageSchema = z.string();
export type RegisterLanguage = z.infer<typeof RegisterLanguageSchema>;

// ── Register type ────────────────────────────────────────────────────────

export const RegisterUndiscriminatedUnionVariantSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    typeName: z.string().optional(),
    type: TypeReferenceSchema,
    displayName: z.string().optional()
});
export type RegisterUndiscriminatedUnionVariant = z.infer<typeof RegisterUndiscriminatedUnionVariantSchema>;

export const RegisterUndiscriminatedUnionTypeSchema = z.object({
    variants: z.array(RegisterUndiscriminatedUnionVariantSchema)
});
export type RegisterUndiscriminatedUnionType = z.infer<typeof RegisterUndiscriminatedUnionTypeSchema>;

export type RegisterTypeShape =
    | RegisterTypeShape.Alias
    | RegisterTypeShape.Enum
    | RegisterTypeShape.UndiscriminatedUnion
    | RegisterTypeShape.DiscriminatedUnion
    | RegisterTypeShape.Object_;

export namespace RegisterTypeShape {
    export interface Alias {
        type: "alias";
        value: TypeReference;
    }
    export interface Enum extends EnumType {
        type: "enum";
    }
    export interface UndiscriminatedUnion extends RegisterUndiscriminatedUnionType {
        type: "undiscriminatedUnion";
    }
    export interface DiscriminatedUnion extends DiscriminatedUnionType {
        type: "discriminatedUnion";
    }
    export interface Object_ extends ObjectType {
        type: "object";
    }
}

export const RegisterTypeShapeSchema: z.ZodType<RegisterTypeShape> = z.lazy(() =>
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
            ...RegisterUndiscriminatedUnionTypeSchema.shape
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

export const RegisterTypeDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    name: z.string(),
    shape: RegisterTypeShapeSchema,
    displayName: z.string().optional()
});
export type RegisterTypeDefinition = z.infer<typeof RegisterTypeDefinitionSchema>;

export const RegisterBytesRequestSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    isOptional: z.boolean(),
    contentType: z.string().optional()
});
export type RegisterBytesRequest = z.infer<typeof RegisterBytesRequestSchema>;

// ── Register endpoint ────────────────────────────────────────────────────

export const RegisterJsonRequestBodySchema = z.object({
    contentType: z.string(),
    shape: JsonBodyShapeSchema
});
export type RegisterJsonRequestBody = z.infer<typeof RegisterJsonRequestBodySchema>;

export const RegisterHttpRequestBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), ...RegisterJsonRequestBodySchema.shape }),
    z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape }),
    z.object({ type: z.literal("bytes"), ...RegisterBytesRequestSchema.shape }),
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("fileUpload"), value: FormDataRequestSchema.optional() })
]);
export type RegisterHttpRequestBodyShape = z.infer<typeof RegisterHttpRequestBodyShapeSchema>;

export const RegisterHttpRequestSchema = z.object({
    description: z.string().optional(),
    type: RegisterHttpRequestBodyShapeSchema
});
export type RegisterHttpRequest = z.infer<typeof RegisterHttpRequestSchema>;

export const RegisterHttpRequestsV2Schema = z.object({
    requests: z.array(RegisterHttpRequestSchema).optional()
});
export type RegisterHttpRequestsV2 = z.infer<typeof RegisterHttpRequestsV2Schema>;

export const RegisterCustomCodeSampleSchema = z.object({
    description: z.string().optional(),
    language: z.string(),
    code: z.string(),
    name: z.string().optional(),
    install: z.string().optional()
});
export type RegisterCustomCodeSample = z.infer<typeof RegisterCustomCodeSampleSchema>;

export const RegisterExampleEndpointCallSchema = z.object({
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
    codeSamples: z.array(RegisterCustomCodeSampleSchema).optional()
});
export type RegisterExampleEndpointCall = z.infer<typeof RegisterExampleEndpointCallSchema>;

export const RegisterNonStreamResponseSchema = z.object({
    shape: JsonBodyShapeSchema,
    examples: z.array(RegisterExampleEndpointCallSchema)
});
export type RegisterNonStreamResponse = z.infer<typeof RegisterNonStreamResponseSchema>;

export const RegisterStreamResponseSchema = z.object({
    shape: JsonBodyShapeSchema,
    examples: z.array(RegisterExampleEndpointCallSchema)
});
export type RegisterStreamResponse = z.infer<typeof RegisterStreamResponseSchema>;

export const RegisterStreamConditionResponseSchema = z.object({
    response: RegisterNonStreamResponseSchema,
    streamResponse: RegisterStreamResponseSchema,
    streamCondition: StreamConditionSchema
});
export type RegisterStreamConditionResponse = z.infer<typeof RegisterStreamConditionResponseSchema>;

export const RegisterHttpResponseBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("fileDownload"), ...FileDownloadResponseBodyShapeSchema.shape }),
    z.object({ type: z.literal("streamingText") }),
    z.object({ type: z.literal("stream"), ...StreamResponseV2Schema.shape }),
    z.object({ type: z.literal("streamCondition"), ...RegisterStreamConditionResponseSchema.shape })
]);
export type RegisterHttpResponseBodyShape = z.infer<typeof RegisterHttpResponseBodyShapeSchema>;

export const RegisterHttpResponseSchema = z.object({
    description: z.string().optional(),
    type: RegisterHttpResponseBodyShapeSchema,
    statusCode: z.number().int().optional(),
    isWildcard: z.boolean().optional()
});
export type RegisterHttpResponse = z.infer<typeof RegisterHttpResponseSchema>;

export const RegisterHttpResponsesV2Schema = z.object({
    responses: z.array(RegisterHttpResponseSchema).optional()
});
export type RegisterHttpResponsesV2 = z.infer<typeof RegisterHttpResponsesV2Schema>;

export const RegisterErrorDeclarationV2Schema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    type: RegisterTypeShapeSchema.optional(),
    statusCode: z.number().int(),
    isWildcard: z.boolean().optional(),
    name: z.string().optional(),
    examples: z.array(ErrorExampleSchema).optional(),
    headers: z.array(HeaderSchema).optional()
});
export type RegisterErrorDeclarationV2 = z.infer<typeof RegisterErrorDeclarationV2Schema>;

export const RegisterEndpointDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    slug: z.string().optional(),
    auth: z.boolean().optional(),
    authV2: z.array(AuthSchemeIdSchema).optional(),
    multiAuth: z.array(MultipleAuthTypeSchema).optional(),
    defaultEnvironment: EnvironmentIdSchema.optional(),
    environments: z.array(EnvironmentSchema).optional(),
    method: HttpMethodSchema,
    id: EndpointIdSchema,
    originalEndpointId: z.string().optional(),
    name: z.string().optional(),
    path: EndpointPathSchema,
    queryParameters: z.array(QueryParameterSchema),
    headers: z.array(HeaderSchema),
    responseHeaders: z.array(HeaderSchema).optional(),
    request: RegisterHttpRequestSchema.optional(),
    requestsV2: RegisterHttpRequestsV2Schema.optional(),
    response: RegisterHttpResponseSchema.optional(),
    responsesV2: RegisterHttpResponsesV2Schema.optional(),
    errors: z.array(ErrorDeclarationSchema).optional(),
    errorsV2: z.array(RegisterErrorDeclarationV2Schema).optional(),
    examples: z.array(RegisterExampleEndpointCallSchema),
    protocol: ProtocolSchema.optional(),
    includeInApiExplorer: z.boolean().optional()
});
export type RegisterEndpointDefinition = z.infer<typeof RegisterEndpointDefinitionSchema>;

// ── Register webhook ─────────────────────────────────────────────────────

export const RegisterWebhookDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    method: WebhookHttpMethodSchema,
    id: WebhookIdSchema,
    name: z.string().optional(),
    path: z.array(z.string()),
    headers: z.array(HeaderSchema),
    payload: WebhookPayloadSchema,
    responses: z.array(RegisterHttpResponseSchema).optional(),
    examples: z.array(ExampleWebhookPayloadSchema)
});
export type RegisterWebhookDefinition = z.infer<typeof RegisterWebhookDefinitionSchema>;

// ── Register websocket ───────────────────────────────────────────────────

export const RegisterWebSocketChannelSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
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
export type RegisterWebSocketChannel = z.infer<typeof RegisterWebSocketChannelSchema>;

// ── Register index schemas ───────────────────────────────────────────────

export const SourceIdSchema = z.string();
export type SourceId = z.infer<typeof SourceIdSchema>;
export function SourceId(value: string): SourceId {
    return value;
}

export const SourceSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("openapi") }),
    z.object({ type: z.literal("asyncapi") }),
    z.object({ type: z.literal("proto") })
]);
export type Source = z.infer<typeof SourceSchema>;

export const SourceUploadSchema = z.object({
    uploadUrl: z.string(),
    downloadUrl: z.string()
});
export type SourceUpload = z.infer<typeof SourceUploadSchema>;

export const DynamicIRSchema = z.object({
    dynamicIR: z.unknown()
});
export type DynamicIR = z.infer<typeof DynamicIRSchema>;

export const DynamicIRUploadSchema = z.object({
    uploadUrl: z.string()
});
export type DynamicIRUpload = z.infer<typeof DynamicIRUploadSchema>;

export const TypescriptPackageSchema = z.object({
    package: z.string(),
    version: z.string().optional()
});
export type TypescriptPackage = z.infer<typeof TypescriptPackageSchema>;

export const PythonPackageSchema = z.object({
    package: z.string(),
    version: z.string().optional()
});
export type PythonPackage = z.infer<typeof PythonPackageSchema>;

export const GoModuleSchema = z.object({
    githubRepo: z.string(),
    version: z.string().optional()
});
export type GoModule = z.infer<typeof GoModuleSchema>;

export const JavaCoordinateSchema = z.object({
    coordinate: z.string(),
    version: z.string().optional()
});
export type JavaCoordinate = z.infer<typeof JavaCoordinateSchema>;

export const RubyGemSchema = z.object({
    gem: z.string(),
    version: z.string().optional()
});
export type RubyGem = z.infer<typeof RubyGemSchema>;

export const NugetPackageSchema = z.object({
    package: z.string(),
    version: z.string().optional()
});
export type NugetPackage = z.infer<typeof NugetPackageSchema>;

export const ComposerPackageSchema = z.object({
    package: z.string(),
    version: z.string().optional()
});
export type ComposerPackage = z.infer<typeof ComposerPackageSchema>;

export const SwiftPackageSchema = z.object({
    package: z.string(),
    version: z.string().optional()
});
export type SwiftPackage = z.infer<typeof SwiftPackageSchema>;

export const CratesPackageSchema = z.object({
    package: z.string(),
    version: z.string().optional()
});
export type CratesPackage = z.infer<typeof CratesPackageSchema>;

export const SnippetsConfigSchema = z.object({
    typescriptSdk: TypescriptPackageSchema.optional(),
    pythonSdk: PythonPackageSchema.optional(),
    goSdk: GoModuleSchema.optional(),
    javaSdk: JavaCoordinateSchema.optional(),
    rubySdk: RubyGemSchema.optional(),
    csharpSdk: NugetPackageSchema.optional(),
    phpSdk: ComposerPackageSchema.optional(),
    swiftSdk: SwiftPackageSchema.optional(),
    rustSdk: CratesPackageSchema.optional()
});
export type SnippetsConfig = z.infer<typeof SnippetsConfigSchema>;

export const RegisterApiDefinitionPackageSchema = z.object({
    endpoints: z.array(RegisterEndpointDefinitionSchema),
    websockets: z.array(RegisterWebSocketChannelSchema).optional(),
    webhooks: z.array(RegisterWebhookDefinitionSchema).optional(),
    graphqlOperations: z.array(GraphQlOperationSchema).optional(),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.optional()
});
export type RegisterApiDefinitionPackage = z.infer<typeof RegisterApiDefinitionPackageSchema>;

export const RegisterApiDefinitionSubpackageSchema = z.object({
    ...RegisterApiDefinitionPackageSchema.shape,
    description: z.string().optional(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    displayName: z.string().optional()
});
export type RegisterApiDefinitionSubpackage = z.infer<typeof RegisterApiDefinitionSubpackageSchema>;

export const RegisterApiDefinitionSchema = z.object({
    rootPackage: RegisterApiDefinitionPackageSchema,
    apiName: z.string().optional(),
    types: z.record(TypeIdSchema, RegisterTypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, RegisterApiDefinitionSubpackageSchema),
    auth: ApiAuthSchema.optional(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).optional(),
    globalHeaders: z.array(HeaderSchema).optional(),
    snippetsConfiguration: SnippetsConfigSchema.optional(),
    navigation: ApiNavigationConfigRootSchema.optional()
});
export type RegisterApiDefinition = z.infer<typeof RegisterApiDefinitionSchema>;

export const RegisterApiDefinitionResponseSchema = z.object({
    apiDefinitionId: ApiDefinitionIdSchema,
    sources: z.record(SourceIdSchema, SourceUploadSchema).optional(),
    dynamicIRs: z.record(z.string(), DynamicIRUploadSchema).optional()
});
export type RegisterApiDefinitionResponse = z.infer<typeof RegisterApiDefinitionResponseSchema>;

export const SnippetInfoSchema = z.object({
    packageName: z.string(),
    version: z.string().optional()
});
export type SnippetInfo = z.infer<typeof SnippetInfoSchema>;

export const SdkDynamicIrDownloadSchema = z.object({
    downloadUrl: z.string()
});
export type SdkDynamicIrDownload = z.infer<typeof SdkDynamicIrDownloadSchema>;

export const GetSdkDynamicIrUploadUrlsResponseSchema = z.object({
    uploadUrls: z.record(z.string(), DynamicIRUploadSchema)
});
export type GetSdkDynamicIrUploadUrlsResponse = z.infer<typeof GetSdkDynamicIrUploadUrlsResponseSchema>;

export const CheckSdkDynamicIrExistsResponseSchema = z.object({
    existingDynamicIrs: z.record(z.string(), SdkDynamicIrDownloadSchema)
});
export type CheckSdkDynamicIrExistsResponse = z.infer<typeof CheckSdkDynamicIrExistsResponseSchema>;

export const EndpointExampleGenerationErrorBodySchema = z.object({
    endpointId: z.string()
});
export type EndpointExampleGenerationErrorBody = z.infer<typeof EndpointExampleGenerationErrorBodySchema>;
