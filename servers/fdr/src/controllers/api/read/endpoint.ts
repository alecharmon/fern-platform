import * as z from "zod";

import {
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EndpointPathSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    ErrorDeclarationSchema,
    ErrorExampleSchema,
    ExampleEndpointRequestSchema,
    ExampleEndpointResponseSchema,
    FileDownloadResponseBodyShapeSchema,
    FormDataRequestSchema,
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
    TypeReferenceSchema
} from "../shared";

import { BytesRequestSchema, TypeShapeSchema } from "./type";

export type {
    BytesValue,
    EndpointPath,
    EndpointPathPart,
    ErrorDeclaration,
    ErrorExample,
    ExampleEndpointRequest,
    ExampleEndpointResponse,
    ExampleErrorResponse,
    ExampleServerSentEvent,
    FileDownloadResponseBodyShape,
    FilenameWithData,
    FormValue,
    Header,
    JsonBodyShape,
    PathParameter,
    QueryParameter,
    StreamCondition,
    StreamResponseV2
} from "../shared";
export {
    BytesValueSchema,
    EndpointPathPartSchema,
    EndpointPathSchema,
    ErrorDeclarationSchema,
    ErrorExampleSchema,
    ExampleEndpointRequestSchema,
    ExampleEndpointResponseSchema,
    ExampleErrorResponseSchema,
    ExampleServerSentEventSchema,
    FileDownloadResponseBodyShapeSchema,
    FilenameWithDataSchema,
    FormValueSchema,
    HeaderSchema,
    JsonBodyShapeSchema,
    PathParameterSchema,
    QueryParameterSchema,
    StreamConditionSchema,
    StreamResponseV2Schema
} from "../shared";

export const HttpRequestBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("bytes"), ...BytesRequestSchema.shape }),
    z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape }),
    z.object({ type: z.literal("fileUpload"), value: FormDataRequestSchema.nullish() })
]);
export type HttpRequestBodyShape = z.infer<typeof HttpRequestBodyShapeSchema>;

export const HttpRequestSchema = z.object({
    description: z.string().nullish(),
    contentType: z.string(),
    type: HttpRequestBodyShapeSchema
});
export type HttpRequest = z.infer<typeof HttpRequestSchema>;

export const HttpRequestsV2Schema = z.object({
    requests: z.array(HttpRequestSchema).nullish()
});
export type HttpRequestsV2 = z.infer<typeof HttpRequestsV2Schema>;

export const SupportedLanguageSchema = z.enum([
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
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const LanguageSchema = z.union([SupportedLanguageSchema, z.string()]);
export type Language = z.infer<typeof LanguageSchema>;

export const CustomCodeSampleSchema = z.object({
    description: z.string().nullish(),
    language: LanguageSchema,
    code: z.string(),
    name: z.string().nullish(),
    install: z.string().nullish()
});
export type CustomCodeSample = z.infer<typeof CustomCodeSampleSchema>;

export const PythonSnippetSchema = z.object({
    async_client: z.string(),
    sync_client: z.string(),
    install: z.string().nullish()
});
export type PythonSnippet = z.infer<typeof PythonSnippetSchema>;

export const TypescriptSnippetSchema = z.object({
    client: z.string(),
    install: z.string().nullish()
});
export type TypescriptSnippet = z.infer<typeof TypescriptSnippetSchema>;

export const GoSnippetSchema = z.object({
    client: z.string(),
    install: z.string().nullish()
});
export type GoSnippet = z.infer<typeof GoSnippetSchema>;

export const RubySnippetSchema = z.object({
    client: z.string(),
    install: z.string().nullish()
});
export type RubySnippet = z.infer<typeof RubySnippetSchema>;

export const CsharpSnippetSchema = z.object({
    client: z.string(),
    install: z.string().nullish()
});
export type CsharpSnippet = z.infer<typeof CsharpSnippetSchema>;

export const CodeExamplesSchema = z.object({
    nodeAxios: z.string().nullish(),
    pythonSdk: PythonSnippetSchema.nullish(),
    typescriptSdk: TypescriptSnippetSchema.nullish(),
    goSdk: GoSnippetSchema.nullish(),
    rubySdk: RubySnippetSchema.nullish(),
    csharpSdk: CsharpSnippetSchema.nullish()
});
export type CodeExamples = z.infer<typeof CodeExamplesSchema>;

export const ExampleEndpointCallSchema = z.object({
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
    codeExamples: CodeExamplesSchema,
    codeSamples: z.array(CustomCodeSampleSchema)
});
export type ExampleEndpointCall = z.infer<typeof ExampleEndpointCallSchema>;

export const NonStreamResponseSchema = z.object({
    shape: JsonBodyShapeSchema,
    examples: z.array(ExampleEndpointCallSchema)
});
export type NonStreamResponse = z.infer<typeof NonStreamResponseSchema>;

export const StreamResponseSchema = z.object({
    shape: JsonBodyShapeSchema,
    examples: z.array(ExampleEndpointCallSchema)
});
export type StreamResponse = z.infer<typeof StreamResponseSchema>;

export const StreamConditionResponseSchema = z.object({
    response: NonStreamResponseSchema,
    streamResponse: StreamResponseSchema,
    streamCondition: StreamConditionSchema
});
export type StreamConditionResponse = z.infer<typeof StreamConditionResponseSchema>;

export const HttpResponseBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("fileDownload"), ...FileDownloadResponseBodyShapeSchema.shape }),
    z.object({ type: z.literal("streamingText") }),
    z.object({ type: z.literal("stream"), ...StreamResponseV2Schema.shape }),
    z.object({ type: z.literal("streamCondition"), ...StreamConditionResponseSchema.shape })
]);
export type HttpResponseBodyShape = z.infer<typeof HttpResponseBodyShapeSchema>;

export const HttpResponseSchema = z.object({
    description: z.string().nullish(),
    type: HttpResponseBodyShapeSchema,
    statusCode: z.number().int().nullish(),
    isWildcard: z.boolean().nullish()
});
export type HttpResponse = z.infer<typeof HttpResponseSchema>;

export const HttpResponsesV2Schema = z.object({
    responses: z.array(HttpResponseSchema).nullish()
});
export type HttpResponsesV2 = z.infer<typeof HttpResponsesV2Schema>;

export const ErrorDeclarationV2Schema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    type: TypeShapeSchema.nullish(),
    statusCode: z.number().int(),
    isWildcard: z.boolean().nullish(),
    name: z.string().nullish(),
    examples: z.array(ErrorExampleSchema).nullish(),
    headers: z.array(HeaderSchema).nullish()
});
export type ErrorDeclarationV2 = z.infer<typeof ErrorDeclarationV2Schema>;

export const EndpointDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    authed: z.boolean(),
    authV2: z.array(AuthSchemeIdSchema).nullish(),
    multiAuth: z.array(MultipleAuthTypeSchema).nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema),
    method: HttpMethodSchema,
    id: EndpointIdSchema,
    originalEndpointId: z.string().nullish(),
    urlSlug: z.string(),
    migratedFromUrlSlugs: z.array(z.string()).nullish(),
    name: z.string().nullish(),
    path: EndpointPathSchema,
    queryParameters: z.array(QueryParameterSchema),
    headers: z.array(HeaderSchema),
    responseHeaders: z.array(HeaderSchema).nullish(),
    request: HttpRequestSchema.nullish(),
    requestsV2: HttpRequestsV2Schema.nullish(),
    response: HttpResponseSchema.nullish(),
    responsesV2: HttpResponsesV2Schema.nullish(),
    errors: z.array(ErrorDeclarationSchema),
    errorsV2: z.array(ErrorDeclarationV2Schema).nullish(),
    examples: z.array(ExampleEndpointCallSchema),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish()
});
export type EndpointDefinition = z.infer<typeof EndpointDefinitionSchema>;
