import * as z from "zod";

export type { ApiDefinitionId, ApiId, HttpMethod, OrgId } from "@fern-api/fdr-sdk/orpc-client";
export { ApiDefinitionIdSchema, ApiIdSchema, HttpMethodSchema, OrgIdSchema } from "@fern-api/fdr-sdk/orpc-client";

export type {
    AuthSchemeId,
    Availability,
    EndpointId,
    Environment,
    EnvironmentId,
    FileId,
    GraphQlOperationId,
    GrpcMethod,
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
    AuthSchemeIdSchema,
    AvailabilitySchema,
    EndpointIdSchema,
    EnvironmentIdSchema,
    EnvironmentSchema,
    FileIdSchema,
    GraphQlOperationIdSchema,
    GrpcMethodSchema,
    GrpcProtocolSchema,
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

export const JqStringSchema = z.string();
export type JqString = z.infer<typeof JqStringSchema>;
