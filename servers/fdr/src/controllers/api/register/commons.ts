import * as z from "zod";

export type {
    ApiDefinitionId,
    AuthSchemeId,
    Availability,
    EndpointId,
    Environment,
    EnvironmentId,
    FileId,
    GraphQlOperationId,
    GrpcMethod,
    HttpMethod,
    MultipleAuthType,
    PropertyKey,
    Protocol,
    SubpackageId,
    WebhookHttpMethod,
    WebhookId,
    WebSocketId,
    WebSocketMessageId,
    WebSocketMessageOrigin,
    WithAvailability,
    WithDescription
} from "../shared";
export {
    ApiDefinitionIdSchema,
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    FileIdSchema,
    GraphQlOperationIdSchema,
    GrpcMethodSchema,
    GrpcProtocolSchema,
    HttpMethodSchema,
    MultipleAuthTypeSchema,
    OpenRpcProtocolSchema,
    PropertyKeySchema,
    ProtocolSchema,
    RestProtocolSchema,
    SubpackageIdSchema,
    WebhookHttpMethodSchema,
    WebhookIdSchema,
    WebSocketIdSchema,
    WebSocketMessageIdSchema,
    WebSocketMessageOriginSchema,
    WithAvailabilitySchema,
    WithDescriptionSchema
} from "../shared";

export const OrgIdSchema = z.string();
export type OrgId = z.infer<typeof OrgIdSchema>;

export const ApiIdSchema = z.string();
export type ApiId = z.infer<typeof ApiIdSchema>;

export const JqStringSchema = z.string();
export type JqString = z.infer<typeof JqStringSchema>;
