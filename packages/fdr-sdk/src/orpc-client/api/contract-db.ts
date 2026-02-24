import * as z from "zod";
import {
    RegisterErrorDeclarationV2Schema,
    RegisterExampleEndpointCallSchema,
    RegisterHttpRequestBodyShapeSchema,
    RegisterHttpResponseSchema,
    RegisterHttpResponsesV2Schema,
    RegisterTypeDefinitionSchema,
    RegisterWebhookDefinitionSchema,
    RegisterWebSocketChannelSchema,
    SnippetsConfigSchema
} from "./contract-register.js";
import {
    ApiAuthSchema,
    ApiDefinitionIdSchema,
    ApiNavigationConfigRootSchema,
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EndpointPathSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    ErrorDeclarationSchema,
    GraphQlOperationSchema,
    HeaderSchema,
    HttpMethodSchema,
    MultipleAuthTypeSchema,
    ProtocolSchema,
    QueryParameterSchema,
    SubpackageIdSchema,
    TypeIdSchema
} from "./shared.js";

// ── DB endpoint ──────────────────────────────────────────────────────────

export const EndpointSnippetTemplatesSchema = z.object({
    typescript: z.unknown().nullish(),
    python: z.unknown().nullish()
});
export type EndpointSnippetTemplates = z.infer<typeof EndpointSnippetTemplatesSchema>;

export const DbHttpRequestSchema = z.object({
    description: z.string().nullish(),
    contentType: z.string().nullish(),
    type: RegisterHttpRequestBodyShapeSchema
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
    response: RegisterHttpResponseSchema.nullish(),
    responsesV2: RegisterHttpResponsesV2Schema.nullish(),
    errors: z.array(ErrorDeclarationSchema).nullish(),
    errorsV2: z.array(RegisterErrorDeclarationV2Schema).nullish(),
    examples: z.array(RegisterExampleEndpointCallSchema),
    snippetTemplates: EndpointSnippetTemplatesSchema.nullish(),
    protocol: ProtocolSchema.nullish(),
    includeInApiExplorer: z.boolean().nullish()
});
export type DbEndpointDefinition = z.infer<typeof DbEndpointDefinitionSchema>;

// ── DB ApiDefinition ─────────────────────────────────────────────────────

export const DbApiDefinitionPackageSchema = z.object({
    endpoints: z.array(DbEndpointDefinitionSchema),
    websockets: z.array(RegisterWebSocketChannelSchema).nullish(),
    webhooks: z.array(RegisterWebhookDefinitionSchema).nullish(),
    graphqlOperations: z.array(GraphQlOperationSchema).nullish(),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.nullish()
});
export type DbApiDefinitionPackage = z.infer<typeof DbApiDefinitionPackageSchema>;

export const DbApiDefinitionSubpackageSchema = z.object({
    ...DbApiDefinitionPackageSchema.shape,
    description: z.string().nullish(),
    parent: SubpackageIdSchema.nullish(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    urlSlug: z.string(),
    displayName: z.string().nullish()
});
export type DbApiDefinitionSubpackage = z.infer<typeof DbApiDefinitionSubpackageSchema>;

export const DbApiDefinitionSchema = z.object({
    id: ApiDefinitionIdSchema,
    apiName: z.string().nullish(),
    rootPackage: DbApiDefinitionPackageSchema,
    types: z.record(TypeIdSchema, RegisterTypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, DbApiDefinitionSubpackageSchema),
    snippetsConfiguration: SnippetsConfigSchema.nullish(),
    auth: ApiAuthSchema.nullish(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).nullish(),
    hasMultipleBaseUrls: z.boolean(),
    navigation: ApiNavigationConfigRootSchema.nullish(),
    globalHeaders: z.array(HeaderSchema).nullish()
});
export type DbApiDefinition = z.infer<typeof DbApiDefinitionSchema>;

export const DbEndpointWithContextSchema = z.object({
    endpoint: DbEndpointDefinitionSchema,
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).nullish(),
    globalHeaders: z.array(HeaderSchema).nullish()
});
export type DbEndpointWithContext = z.infer<typeof DbEndpointWithContextSchema>;
