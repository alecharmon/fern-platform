import * as z from "zod";
import {
    ErrorDeclarationV2Schema,
    ExampleEndpointCallSchema,
    HttpRequestBodyShapeSchema,
    HttpResponseSchema,
    HttpResponsesV2Schema
} from "../register/endpoint";
import {
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EndpointPathSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    ErrorDeclarationSchema,
    HeaderSchema,
    HttpMethodSchema,
    MultipleAuthTypeSchema,
    ProtocolSchema,
    QueryParameterSchema
} from "../shared";

export const EndpointSnippetTemplatesSchema = z.object({
    typescript: z.unknown().nullish(),
    python: z.unknown().nullish()
});
export type EndpointSnippetTemplates = z.infer<typeof EndpointSnippetTemplatesSchema>;

export const DbHttpRequestSchema = z.object({
    description: z.string().nullish(),
    contentType: z.string().nullish(),
    type: HttpRequestBodyShapeSchema
});
export type DbHttpRequest = z.infer<typeof DbHttpRequestSchema>;

export const DbHttpRequestsV2Schema = z.object({
    requests: z.array(DbHttpRequestSchema).nullish()
});
export type DbHttpRequestsV2 = z.infer<typeof DbHttpRequestsV2Schema>;

export const DbEndpointDefinitionSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    authed: z.boolean().nullish(),
    authV2: z.array(AuthSchemeIdSchema).nullish(),
    multiAuth: z.array(MultipleAuthTypeSchema).nullish(),
    defaultEnvironment: EnvironmentIdSchema.nullish(),
    environments: z.array(EnvironmentSchema).nullish(),
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
    request: DbHttpRequestSchema.nullish(),
    requestsV2: DbHttpRequestsV2Schema.nullish(),
    response: HttpResponseSchema.nullish(),
    responsesV2: HttpResponsesV2Schema.nullish(),
    errors: z.array(ErrorDeclarationSchema).nullish(),
    errorsV2: z.array(ErrorDeclarationV2Schema).nullish(),
    examples: z.array(ExampleEndpointCallSchema),
    snippetTemplates: EndpointSnippetTemplatesSchema.nullish(),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish()
});
export type DbEndpointDefinition = z.infer<typeof DbEndpointDefinitionSchema>;
