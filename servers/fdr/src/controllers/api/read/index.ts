import * as z from "zod";
import { ApiAuthSchema, SnippetsConfigSchema } from "../register";
import {
    ApiDefinitionIdSchema,
    AuthSchemeIdSchema,
    EndpointIdSchema,
    GraphQlOperationIdSchema,
    SubpackageIdSchema,
    TypeIdSchema,
    WebhookIdSchema,
    WebSocketIdSchema
} from "../register/commons";
import { EndpointDefinitionSchema, HeaderSchema } from "./endpoint";
import { GraphQlOperationSchema } from "./graphql";
import { TypeDefinitionSchema } from "./type";
import { WebhookDefinitionSchema } from "./webhook";
import { WebSocketChannelSchema } from "./websocket";

export type ApiNavigationConfigItem =
    | ApiNavigationConfigItem.Subpackage
    | ApiNavigationConfigItem.EndpointId
    | ApiNavigationConfigItem.WebsocketId
    | ApiNavigationConfigItem.WebhookId
    | ApiNavigationConfigItem.GraphqlOperationId;

export namespace ApiNavigationConfigItem {
    export interface Subpackage {
        type: "subpackage";
        subpackageId: string;
        items: ApiNavigationConfigItem[];
    }
    export interface EndpointId {
        type: "endpointId";
        value: string;
    }
    export interface WebsocketId {
        type: "websocketId";
        value: string;
    }
    export interface WebhookId {
        type: "webhookId";
        value: string;
    }
    export interface GraphqlOperationId {
        type: "graphqlOperationId";
        value: string;
    }
}

export const ApiNavigationConfigItemSchema: z.ZodType<ApiNavigationConfigItem> = z.lazy(() =>
    z.discriminatedUnion("type", [
        z.object({
            type: z.literal("subpackage"),
            subpackageId: SubpackageIdSchema,
            items: z.array(ApiNavigationConfigItemSchema)
        }),
        z.object({ type: z.literal("endpointId"), value: EndpointIdSchema }),
        z.object({ type: z.literal("websocketId"), value: WebSocketIdSchema }),
        z.object({ type: z.literal("webhookId"), value: WebhookIdSchema }),
        z.object({ type: z.literal("graphqlOperationId"), value: GraphQlOperationIdSchema })
    ])
);

export const ApiNavigationConfigRootSchema = z.object({
    items: z.array(ApiNavigationConfigItemSchema)
});
export type ApiNavigationConfigRoot = z.infer<typeof ApiNavigationConfigRootSchema>;

export const ApiDefinitionPackageSchema = z.object({
    endpoints: z.array(EndpointDefinitionSchema),
    websockets: z.array(WebSocketChannelSchema),
    webhooks: z.array(WebhookDefinitionSchema),
    graphqlOperations: z.array(GraphQlOperationSchema),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.nullish()
});
export type ApiDefinitionPackage = z.infer<typeof ApiDefinitionPackageSchema>;

export const ApiDefinitionSubpackageSchema = z.object({
    description: z.string().nullish(),
    ...ApiDefinitionPackageSchema.shape,
    parent: SubpackageIdSchema.nullish(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    urlSlug: z.string(),
    displayName: z.string().nullish()
});
export type ApiDefinitionSubpackage = z.infer<typeof ApiDefinitionSubpackageSchema>;

export const ApiDefinitionSchema = z.object({
    id: ApiDefinitionIdSchema,
    apiName: z.string().nullish(),
    rootPackage: ApiDefinitionPackageSchema,
    types: z.record(TypeIdSchema, TypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, ApiDefinitionSubpackageSchema),
    snippetsConfiguration: SnippetsConfigSchema.nullish(),
    auth: ApiAuthSchema.nullish(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).nullish(),
    hasMultipleBaseUrls: z.boolean().nullish(),
    navigation: ApiNavigationConfigRootSchema.nullish(),
    globalHeaders: z.array(HeaderSchema).nullish()
});
export type ApiDefinition = z.infer<typeof ApiDefinitionSchema>;

export * from "./endpoint";
export * from "./graphql";
export * from "./type";
export * from "./webhook";
export * from "./websocket";
