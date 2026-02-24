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
    typescript: z.unknown().optional(),
    python: z.unknown().optional()
});
export type EndpointSnippetTemplates = z.infer<typeof EndpointSnippetTemplatesSchema>;

export const DbHttpRequestSchema = z.object({
    description: z.string().optional(),
    contentType: z.string().optional(),
    type: RegisterHttpRequestBodyShapeSchema
});
export type DbHttpRequest = z.infer<typeof DbHttpRequestSchema>;

export const DbHttpRequestsV2Schema = z.object({
    requests: z.array(DbHttpRequestSchema).optional()
});
export type DbHttpRequestsV2 = z.infer<typeof DbHttpRequestsV2Schema>;

export const DbEndpointDefinitionSchema = z.object({
    description: z.string().optional(),
    availability: AvailabilitySchema.optional(),
    authed: z.boolean().optional(),
    authV2: z.array(AuthSchemeIdSchema).optional(),
    multiAuth: z.array(MultipleAuthTypeSchema).optional(),
    defaultEnvironment: EnvironmentIdSchema.optional(),
    environments: z.array(EnvironmentSchema).optional(),
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
    request: DbHttpRequestSchema.optional(),
    requestsV2: DbHttpRequestsV2Schema.optional(),
    response: RegisterHttpResponseSchema.optional(),
    responsesV2: RegisterHttpResponsesV2Schema.optional(),
    errors: z.array(ErrorDeclarationSchema).optional(),
    errorsV2: z.array(RegisterErrorDeclarationV2Schema).optional(),
    examples: z.array(RegisterExampleEndpointCallSchema),
    snippetTemplates: EndpointSnippetTemplatesSchema.optional(),
    protocol: ProtocolSchema.optional(),
    includeInApiExplorer: z.boolean().optional()
});
export type DbEndpointDefinition = z.infer<typeof DbEndpointDefinitionSchema>;

// ── DB ApiDefinition ─────────────────────────────────────────────────────

export const DbApiDefinitionPackageSchema = z.object({
    endpoints: z.array(DbEndpointDefinitionSchema),
    websockets: z.array(RegisterWebSocketChannelSchema).optional(),
    webhooks: z.array(RegisterWebhookDefinitionSchema).optional(),
    graphqlOperations: z.array(GraphQlOperationSchema).optional(),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.optional()
});
export type DbApiDefinitionPackage = z.infer<typeof DbApiDefinitionPackageSchema>;

export const DbApiDefinitionSubpackageSchema = z.object({
    ...DbApiDefinitionPackageSchema.shape,
    description: z.string().optional(),
    parent: SubpackageIdSchema.optional(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    urlSlug: z.string(),
    displayName: z.string().optional()
});
export type DbApiDefinitionSubpackage = z.infer<typeof DbApiDefinitionSubpackageSchema>;

export const DbApiDefinitionSchema = z.object({
    id: ApiDefinitionIdSchema,
    apiName: z.string().optional(),
    rootPackage: DbApiDefinitionPackageSchema,
    types: z.record(TypeIdSchema, RegisterTypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, DbApiDefinitionSubpackageSchema),
    snippetsConfiguration: SnippetsConfigSchema.optional(),
    auth: ApiAuthSchema.optional(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).optional(),
    hasMultipleBaseUrls: z.boolean(),
    navigation: ApiNavigationConfigRootSchema.optional(),
    globalHeaders: z.array(HeaderSchema).optional()
});
export type DbApiDefinition = z.infer<typeof DbApiDefinitionSchema>;

export const DbEndpointWithContextSchema = z.object({
    endpoint: DbEndpointDefinitionSchema,
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).optional(),
    globalHeaders: z.array(HeaderSchema).optional()
});
export type DbEndpointWithContext = z.infer<typeof DbEndpointWithContextSchema>;
