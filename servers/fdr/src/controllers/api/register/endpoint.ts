import * as z from "zod";

import {
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    FileIdSchema,
    HttpMethodSchema,
    MultipleAuthTypeSchema,
    PropertyKeySchema,
    ProtocolSchema
} from "./commons";
import {
    BytesRequestSchema,
    FormDataRequestSchema,
    ObjectTypeSchema,
    TypeReferenceSchema,
    TypeShapeSchema
} from "./type";

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

export const JsonRequestBodySchema = z.object({
    contentType: z.string(),
    shape: JsonBodyShapeSchema
});
export type JsonRequestBody = z.infer<typeof JsonRequestBodySchema>;

export const HttpRequestBodyShapeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), ...JsonRequestBodySchema.shape }),
    z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape }),
    z.object({ type: z.literal("bytes"), ...BytesRequestSchema.shape }),
    z.object({ type: z.literal("object"), ...ObjectTypeSchema.shape }),
    z.object({ type: z.literal("reference"), value: TypeReferenceSchema }),
    z.object({ type: z.literal("fileUpload"), value: FormDataRequestSchema.nullish() })
]);
export type HttpRequestBodyShape = z.infer<typeof HttpRequestBodyShapeSchema>;

export const HttpRequestSchema = z.object({
    description: z.string().nullish(),
    type: HttpRequestBodyShapeSchema
});
export type HttpRequest = z.infer<typeof HttpRequestSchema>;

export const HttpRequestsV2Schema = z.object({
    requests: z.array(HttpRequestSchema).nullish()
});
export type HttpRequestsV2 = z.infer<typeof HttpRequestsV2Schema>;

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

export const ExampleEndpointRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("form"), value: z.record(z.string(), FormValueSchema) }),
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

export const CustomCodeSampleSchema = z.object({
    description: z.string().nullish(),
    language: z.string(),
    code: z.string(),
    name: z.string().nullish(),
    install: z.string().nullish()
});
export type CustomCodeSample = z.infer<typeof CustomCodeSampleSchema>;

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
    codeSamples: z.array(CustomCodeSampleSchema).nullish()
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
    request: HttpRequestSchema.nullish(),
    requestsV2: HttpRequestsV2Schema.nullish(),
    response: HttpResponseSchema.nullish(),
    responsesV2: HttpResponsesV2Schema.nullish(),
    errors: z.array(ErrorDeclarationSchema).nullish(),
    errorsV2: z.array(ErrorDeclarationV2Schema).nullish(),
    examples: z.array(ExampleEndpointCallSchema),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish()
});
export type EndpointDefinition = z.infer<typeof EndpointDefinitionSchema>;
