import * as z from "zod";
import { SnippetsConfigSchema } from "../register";
import { AuthSchemeSchema } from "./auth";
import {
    ApiDefinitionIdSchema,
    AuthSchemeIdSchema,
    EndpointIdSchema,
    GraphQlOperationIdSchema,
    SubpackageIdSchema,
    TypeIdSchema,
    WebhookIdSchema,
    WebSocketIdSchema
} from "./commons";
import { EndpointDefinitionSchema } from "./endpoint";
import { GraphQlOperationSchema } from "./graphql";
import { ObjectPropertySchema, TypeDefinitionSchema } from "./type";
import { WebhookDefinitionSchema } from "./webhook";
import { WebSocketChannelSchema } from "./websocket";

export const SubpackageMetadataSchema = z.object({
    id: SubpackageIdSchema,
    name: z.string(),
    displayName: z.string().nullish()
});
export type SubpackageMetadata = z.infer<typeof SubpackageMetadataSchema>;

export const ApiDefinitionSchema = z.object({
    id: ApiDefinitionIdSchema,
    apiName: z.string().nullish(),
    endpoints: z.record(EndpointIdSchema, EndpointDefinitionSchema),
    websockets: z.record(WebSocketIdSchema, WebSocketChannelSchema),
    webhooks: z.record(WebhookIdSchema, WebhookDefinitionSchema),
    graphqlOperations: z.record(GraphQlOperationIdSchema, GraphQlOperationSchema),
    types: z.record(TypeIdSchema, TypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, SubpackageMetadataSchema),
    auths: z.record(AuthSchemeIdSchema, AuthSchemeSchema),
    globalHeaders: z.array(ObjectPropertySchema).nullish(),
    snippetsConfiguration: SnippetsConfigSchema.nullish()
});
export type ApiDefinition = z.infer<typeof ApiDefinitionSchema>;

export * from "./auth";
export * from "./commons";
export * from "./endpoint";
export * from "./graphql";
export * from "./type";
export * from "./webhook";
export * from "./websocket";
