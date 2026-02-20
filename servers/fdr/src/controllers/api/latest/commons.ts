import * as z from "zod";

import { EndpointPathPartSchema, SubpackageIdSchema } from "../shared";

export type {
    ApiDefinitionId,
    AuthSchemeId,
    Availability,
    EndpointId,
    Environment,
    EnvironmentId,
    GraphQlOperationId,
    GrpcMethod,
    HttpMethod,
    MultipleAuthType,
    Protocol,
    SubpackageId,
    TypeId,
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
    TypeIdSchema,
    WebhookHttpMethodSchema,
    WebhookIdSchema,
    WebSocketIdSchema,
    WebSocketMessageIdSchema,
    WebSocketMessageOriginSchema,
    WithAvailabilitySchema,
    WithDescriptionSchema
} from "../shared";

export const PathPartSchema = EndpointPathPartSchema;
export type PathPart = z.infer<typeof PathPartSchema>;

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
