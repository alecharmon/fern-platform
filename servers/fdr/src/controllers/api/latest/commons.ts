import * as z from "zod";

export const ApiDefinitionIdSchema = z.string().uuid();
export type ApiDefinitionId = z.infer<typeof ApiDefinitionIdSchema>;

export const TypeIdSchema = z.string();
export type TypeId = z.infer<typeof TypeIdSchema>;

export const EndpointIdSchema = z.string();
export type EndpointId = z.infer<typeof EndpointIdSchema>;

export const WebSocketIdSchema = z.string();
export type WebSocketId = z.infer<typeof WebSocketIdSchema>;

export const WebhookIdSchema = z.string();
export type WebhookId = z.infer<typeof WebhookIdSchema>;

export const GraphQlOperationIdSchema = z.string();
export type GraphQlOperationId = z.infer<typeof GraphQlOperationIdSchema>;

export const EnvironmentIdSchema = z.string();
export type EnvironmentId = z.infer<typeof EnvironmentIdSchema>;

export const PropertyKeySchema = z.string();
export type PropertyKey = z.infer<typeof PropertyKeySchema>;

export const AuthSchemeIdSchema = z.string();
export type AuthSchemeId = z.infer<typeof AuthSchemeIdSchema>;

export const MultipleAuthTypeSchema = z.object({
    schemes: z.array(AuthSchemeIdSchema)
});
export type MultipleAuthType = z.infer<typeof MultipleAuthTypeSchema>;

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const GrpcMethodSchema = z.enum(["UNARY", "CLIENT_STREAM", "SERVER_STREAM", "BIDIRECTIONAL_STREAM"]);
export type GrpcMethod = z.infer<typeof GrpcMethodSchema>;

export const AvailabilitySchema = z.enum([
    "Stable",
    "GenerallyAvailable",
    "InDevelopment",
    "PreRelease",
    "Deprecated",
    "Beta"
]);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const SubpackageIdSchema = z.string();
export type SubpackageId = z.infer<typeof SubpackageIdSchema>;

export const WebSocketMessageIdSchema = z.string();
export type WebSocketMessageId = z.infer<typeof WebSocketMessageIdSchema>;

export const WebSocketMessageOriginSchema = z.enum(["client", "server"]);
export type WebSocketMessageOrigin = z.infer<typeof WebSocketMessageOriginSchema>;

export const WithDescriptionSchema = z.object({
    description: z.string().nullish()
});
export type WithDescription = z.infer<typeof WithDescriptionSchema>;

export const WithAvailabilitySchema = z.object({
    availability: AvailabilitySchema.nullish()
});
export type WithAvailability = z.infer<typeof WithAvailabilitySchema>;

export const WithNamespaceSchema = z.object({
    namespace: z.array(SubpackageIdSchema).nullish()
});
export type WithNamespace = z.infer<typeof WithNamespaceSchema>;

export const SubpackageMetadataSchema = z.object({
    id: SubpackageIdSchema,
    name: z.string(),
    displayName: z.string().nullish()
});
export type SubpackageMetadata = z.infer<typeof SubpackageMetadataSchema>;

export const EnvironmentSchema = z.object({
    id: EnvironmentIdSchema,
    baseUrl: z.string(),
    audiences: z.array(z.string()).nullish()
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const PathPartSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("literal"), value: z.string() }),
    z.object({ type: z.literal("pathParameter"), value: PropertyKeySchema })
]);
export type PathPart = z.infer<typeof PathPartSchema>;

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

export const WebhookHttpMethodSchema = z.enum(["GET", "POST"]);
export type WebhookHttpMethod = z.infer<typeof WebhookHttpMethodSchema>;
