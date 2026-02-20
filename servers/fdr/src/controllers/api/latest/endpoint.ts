import * as z from "zod";

import {
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    HttpMethodSchema,
    MultipleAuthTypeSchema,
    PathPartSchema,
    PropertyKeySchema,
    ProtocolSchema,
    TypeIdSchema
} from "./commons";
import {
    BytesRequestSchema,
    FormDataRequestSchema,
    ObjectPropertySchema,
    ParameterPropertySchema,
    TypeReferenceSchema,
    TypeShapeSchema
} from "./type";

export const LanguageSchema = z.string();
export type Language = z.infer<typeof LanguageSchema>;

export const ExampleEndpointRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("form"), value: z.record(z.string(), z.unknown()) }),
    z.object({ type: z.literal("bytes"), value: z.unknown() })
]);
export type ExampleEndpointRequest = z.infer<typeof ExampleEndpointRequestSchema>;

export const ExampleEndpointResponseSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() }),
    z.object({ type: z.literal("filename"), value: z.string() }),
    z.object({ type: z.literal("stream"), value: z.array(z.unknown()) }),
    z.object({ type: z.literal("sse"), value: z.array(z.object({ event: z.string(), data: z.unknown() })) })
]);
export type ExampleEndpointResponse = z.infer<typeof ExampleEndpointResponseSchema>;

export const ExampleErrorResponseSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("json"), value: z.unknown() })
]);
export type ExampleErrorResponse = z.infer<typeof ExampleErrorResponseSchema>;

export const HttpRequestBodyShapeSchema: z.ZodType<HttpRequestBodyShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(ObjectPropertySchema),
            extraProperties: TypeReferenceSchema.nullish()
        }),
        z.object({ type: z.literal("alias"), value: TypeReferenceSchema }),
        z.object({ type: z.literal("bytes"), ...BytesRequestSchema.shape }),
        z.object({ type: z.literal("formData"), ...FormDataRequestSchema.shape })
    ])
);

import type { ObjectType, TypeReference } from "./type";

export type HttpRequestBodyShape =
    | ({ type: "object" } & ObjectType)
    | { type: "alias"; value: TypeReference }
    | ({ type: "bytes" } & z.infer<typeof BytesRequestSchema>)
    | ({ type: "formData" } & z.infer<typeof FormDataRequestSchema>);

export const HttpRequestSchema = z.object({
    description: z.string().nullish(),
    contentType: z.string().nullish(),
    body: HttpRequestBodyShapeSchema
});
export type HttpRequest = z.infer<typeof HttpRequestSchema>;

export const FileDownloadResponseBodyShapeSchema = z.object({
    contentType: z.string().nullish()
});
export type FileDownloadResponseBodyShape = z.infer<typeof FileDownloadResponseBodyShapeSchema>;

export const StreamResponseSchema = z.object({
    terminator: z.string().nullish(),
    shape: TypeShapeSchema
});
export type StreamResponse = z.infer<typeof StreamResponseSchema>;

export type HttpResponseBodyShape =
    | { type: "empty" }
    | ({ type: "object" } & ObjectType)
    | { type: "alias"; value: TypeReference }
    | ({ type: "fileDownload" } & z.infer<typeof FileDownloadResponseBodyShapeSchema>)
    | { type: "streamingText" }
    | ({ type: "stream" } & z.infer<typeof StreamResponseSchema>);

export const HttpResponseBodyShapeSchema: z.ZodType<HttpResponseBodyShape> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({ type: z.literal("empty") }),
        z.object({
            type: z.literal("object"),
            extends: z.array(TypeIdSchema),
            properties: z.array(ObjectPropertySchema),
            extraProperties: TypeReferenceSchema.nullish()
        }),
        z.object({ type: z.literal("alias"), value: TypeReferenceSchema }),
        z.object({ type: z.literal("fileDownload"), ...FileDownloadResponseBodyShapeSchema.shape }),
        z.object({ type: z.literal("streamingText") }),
        z.object({ type: z.literal("stream"), ...StreamResponseSchema.shape })
    ])
);

export const HttpResponseSchema = z.object({
    description: z.string().nullish(),
    body: HttpResponseBodyShapeSchema,
    statusCode: z.number().int(),
    isWildcard: z.boolean().nullish()
});
export type HttpResponse = z.infer<typeof HttpResponseSchema>;

export const ErrorExampleSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    responseBody: ExampleErrorResponseSchema
});
export type ErrorExample = z.infer<typeof ErrorExampleSchema>;

export const ErrorResponseSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    shape: TypeShapeSchema.nullish(),
    statusCode: z.number().int(),
    isWildcard: z.boolean().nullish(),
    name: z.string(),
    examples: z.array(ErrorExampleSchema).nullish(),
    headers: z.array(ObjectPropertySchema).nullish()
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const CodeSnippetSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    language: LanguageSchema,
    install: z.string().nullish(),
    code: z.string(),
    generated: z.boolean()
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const ExampleEndpointCallSchema = z.object({
    description: z.string().nullish(),
    path: z.string(),
    responseStatusCode: z.number().int(),
    name: z.string().nullish(),
    pathParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    queryParameters: z.record(PropertyKeySchema, z.unknown()).nullish(),
    headers: z.record(PropertyKeySchema, z.unknown()).nullish(),
    requestBody: ExampleEndpointRequestSchema.nullish(),
    responseBody: ExampleEndpointResponseSchema.nullish(),
    snippets: z.record(LanguageSchema, z.array(CodeSnippetSchema)).nullish()
});
export type ExampleEndpointCall = z.infer<typeof ExampleEndpointCallSchema>;

export const EndpointDefinitionSchema = z.object({
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
    pathParameters: z.array(ParameterPropertySchema).nullish(),
    queryParameters: z.array(ParameterPropertySchema).nullish(),
    requestHeaders: z.array(ObjectPropertySchema).nullish(),
    responseHeaders: z.array(ObjectPropertySchema).nullish(),
    requests: z.array(HttpRequestSchema).nullish(),
    responses: z.array(HttpResponseSchema).nullish(),
    errors: z.array(ErrorResponseSchema).nullish(),
    examples: z.array(ExampleEndpointCallSchema).nullish(),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish()
});
export type EndpointDefinition = z.infer<typeof EndpointDefinitionSchema>;
