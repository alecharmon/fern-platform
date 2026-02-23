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
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    typeName: z.string().nullish(),
    type: TypeReferenceSchema,
    displayName: z.string().nullish()
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
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    shape: RegisterTypeShapeSchema,
    displayName: z.string().nullish()
});
export type RegisterTypeDefinition = z.infer<typeof RegisterTypeDefinitionSchema>;

export const RegisterBytesRequestSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    isOptional: z.boolean(),
    contentType: z.string().nullish()
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
    z.object({ type: z.literal("fileUpload"), value: FormDataRequestSchema.nullish() })
]);
export type RegisterHttpRequestBodyShape = z.infer<typeof RegisterHttpRequestBodyShapeSchema>;

export const RegisterHttpRequestSchema = z.object({
    description: z.string().nullish(),
    type: RegisterHttpRequestBodyShapeSchema
});
export type RegisterHttpRequest = z.infer<typeof RegisterHttpRequestSchema>;

export const RegisterHttpRequestsV2Schema = z.object({
    requests: z.array(RegisterHttpRequestSchema).nullish()
});
export type RegisterHttpRequestsV2 = z.infer<typeof RegisterHttpRequestsV2Schema>;

export const RegisterCustomCodeSampleSchema = z.object({
    description: z.string().nullish(),
    language: z.string(),
    code: z.string(),
    name: z.string().nullish(),
    install: z.string().nullish()
});
export type RegisterCustomCodeSample = z.infer<typeof RegisterCustomCodeSampleSchema>;

export const RegisterExampleEndpointCallSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    path: z.string(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()),
    queryParameters: z.record(z.string(), z.unknown()),
    headers: z.record(z.string(), z.unknown()),
    requestBody: z.unknown(),
    requestBodyV3: ExampleEndpointRequestSchema.nullish(),
    responseStatusCode: z.number().int(),
    responseBody: z.unknown(),
    responseBodyV3: ExampleEndpointResponseSchema.nullish(),
    codeSamples: z.array(RegisterCustomCodeSampleSchema).nullish()
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
    description: z.string().nullish(),
    type: RegisterHttpResponseBodyShapeSchema,
    statusCode: z.number().int().nullish(),
    isWildcard: z.boolean().nullish()
});
export type RegisterHttpResponse = z.infer<typeof RegisterHttpResponseSchema>;

export const RegisterHttpResponsesV2Schema = z.object({
    responses: z.array(RegisterHttpResponseSchema).nullish()
});
export type RegisterHttpResponsesV2 = z.infer<typeof RegisterHttpResponsesV2Schema>;

export const RegisterErrorDeclarationV2Schema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: RegisterTypeShapeSchema.nullish(),
    statusCode: z.number().int(),
    isWildcard: z.boolean().nullish(),
    name: z.string().nullish(),
    examples: z.array(ErrorExampleSchema).nullish(),
    headers: z.array(HeaderSchema).nullish()
});
export type RegisterErrorDeclarationV2 = z.infer<typeof RegisterErrorDeclarationV2Schema>;

export const RegisterEndpointDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    slug: z.string().nullish(),
    auth: z.boolean().nullish(),
    authV2: z.array(AuthSchemeIdSchema).nullish(),
    multiAuth: z.array(MultipleAuthTypeSchema).nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema).nullish(),
    method: HttpMethodSchema,
    id: EndpointIdSchema,
    originalEndpointId: z.string().nullish(),
    name: z.string().nullish(),
    path: EndpointPathSchema,
    queryParameters: z.array(QueryParameterSchema),
    headers: z.array(HeaderSchema),
    responseHeaders: z.array(HeaderSchema).nullish(),
    request: RegisterHttpRequestSchema.nullish(),
    requestsV2: RegisterHttpRequestsV2Schema.nullish(),
    response: RegisterHttpResponseSchema.nullish(),
    responsesV2: RegisterHttpResponsesV2Schema.nullish(),
    errors: z.array(ErrorDeclarationSchema).nullish(),
    errorsV2: z.array(RegisterErrorDeclarationV2Schema).nullish(),
    examples: z.array(RegisterExampleEndpointCallSchema),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish()
});
export type RegisterEndpointDefinition = z.infer<typeof RegisterEndpointDefinitionSchema>;

// ── Register webhook ─────────────────────────────────────────────────────

export const RegisterWebhookDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    method: WebhookHttpMethodSchema,
    id: WebhookIdSchema,
    name: z.string().nullish(),
    path: z.array(z.string()),
    headers: z.array(HeaderSchema),
    payload: WebhookPayloadSchema,
    responses: z.array(RegisterHttpResponseSchema).nullish(),
    examples: z.array(ExampleWebhookPayloadSchema)
});
export type RegisterWebhookDefinition = z.infer<typeof RegisterWebhookDefinitionSchema>;

// ── Register websocket ───────────────────────────────────────────────────

export const RegisterWebSocketChannelSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    id: WebSocketIdSchema,
    auth: z.boolean(),
    name: z.string().nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
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
    version: z.string().nullish()
});
export type TypescriptPackage = z.infer<typeof TypescriptPackageSchema>;

export const PythonPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type PythonPackage = z.infer<typeof PythonPackageSchema>;

export const GoModuleSchema = z.object({
    githubRepo: z.string(),
    version: z.string().nullish()
});
export type GoModule = z.infer<typeof GoModuleSchema>;

export const JavaCoordinateSchema = z.object({
    coordinate: z.string(),
    version: z.string().nullish()
});
export type JavaCoordinate = z.infer<typeof JavaCoordinateSchema>;

export const RubyGemSchema = z.object({
    gem: z.string(),
    version: z.string().nullish()
});
export type RubyGem = z.infer<typeof RubyGemSchema>;

export const NugetPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type NugetPackage = z.infer<typeof NugetPackageSchema>;

export const ComposerPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type ComposerPackage = z.infer<typeof ComposerPackageSchema>;

export const SwiftPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type SwiftPackage = z.infer<typeof SwiftPackageSchema>;

export const CratesPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type CratesPackage = z.infer<typeof CratesPackageSchema>;

export const SnippetsConfigSchema = z.object({
    typescriptSdk: TypescriptPackageSchema.nullish(),
    pythonSdk: PythonPackageSchema.nullish(),
    goSdk: GoModuleSchema.nullish(),
    javaSdk: JavaCoordinateSchema.nullish(),
    rubySdk: RubyGemSchema.nullish(),
    csharpSdk: NugetPackageSchema.nullish(),
    phpSdk: ComposerPackageSchema.nullish(),
    swiftSdk: SwiftPackageSchema.nullish(),
    rustSdk: CratesPackageSchema.nullish()
});
export type SnippetsConfig = z.infer<typeof SnippetsConfigSchema>;

export const RegisterApiDefinitionPackageSchema = z.object({
    endpoints: z.array(RegisterEndpointDefinitionSchema),
    websockets: z.array(RegisterWebSocketChannelSchema).nullish(),
    webhooks: z.array(RegisterWebhookDefinitionSchema).nullish(),
    graphqlOperations: z.array(GraphQlOperationSchema).nullish(),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.nullish()
});
export type RegisterApiDefinitionPackage = z.infer<typeof RegisterApiDefinitionPackageSchema>;

export const RegisterApiDefinitionSubpackageSchema = z.object({
    ...RegisterApiDefinitionPackageSchema.shape,
    description: z.string().nullish(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    displayName: z.string().nullish()
});
export type RegisterApiDefinitionSubpackage = z.infer<typeof RegisterApiDefinitionSubpackageSchema>;

export const RegisterApiDefinitionSchema = z.object({
    rootPackage: RegisterApiDefinitionPackageSchema,
    apiName: z.string().nullish(),
    types: z.record(TypeIdSchema, RegisterTypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, RegisterApiDefinitionSubpackageSchema),
    auth: ApiAuthSchema.nullish(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).nullish(),
    globalHeaders: z.array(HeaderSchema).nullish(),
    snippetsConfiguration: SnippetsConfigSchema.nullish(),
    navigation: ApiNavigationConfigRootSchema.nullish()
});
export type RegisterApiDefinition = z.infer<typeof RegisterApiDefinitionSchema>;

export const RegisterApiDefinitionResponseSchema = z.object({
    apiDefinitionId: ApiDefinitionIdSchema,
    sources: z.record(SourceIdSchema, SourceUploadSchema).nullish(),
    dynamicIRs: z.record(z.string(), DynamicIRUploadSchema).nullish()
});
export type RegisterApiDefinitionResponse = z.infer<typeof RegisterApiDefinitionResponseSchema>;

export const SnippetInfoSchema = z.object({
    packageName: z.string(),
    version: z.string().nullish()
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
