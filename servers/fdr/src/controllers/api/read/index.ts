import * as z from "zod";
import { ApiAuthSchema, SnippetsConfigSchema } from "../register";
import {
    ApiDefinitionIdSchema,
    ApiNavigationConfigRootSchema,
    AuthSchemeIdSchema,
    SubpackageIdSchema,
    TypeIdSchema
} from "../shared";
import { EndpointDefinitionSchema, HeaderSchema } from "./endpoint";
import { GraphQlOperationSchema } from "./graphql";
import { TypeDefinitionSchema } from "./type";
import { WebhookDefinitionSchema } from "./webhook";
import { WebSocketChannelSchema } from "./websocket";

export type {
    ApiAuth,
    ApiNavigationConfigItem,
    ApiNavigationConfigRoot,
    BasicAuth,
    BearerAuth,
    HeaderAuth,
    OAuth,
    OAuthClientCredentials,
    OAuthClientCredentialsReferencedEndpoint
} from "../shared";
export {
    ApiAuthSchema,
    ApiNavigationConfigItemSchema,
    ApiNavigationConfigRootSchema,
    BasicAuthSchema,
    BearerAuthSchema,
    HeaderAuthSchema,
    OAuthClientCredentialsReferencedEndpointSchema,
    OAuthClientCredentialsSchema,
    OAuthSchema
} from "../shared";

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
