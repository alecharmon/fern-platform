import * as z from "zod";

import { ApiDefinitionIdSchema, AuthSchemeIdSchema, SubpackageIdSchema, TypeIdSchema } from "../register/commons";
import { HeaderSchema } from "../register/endpoint";
import { GraphQlOperationSchema } from "../register/graphql";
import { ApiAuthSchema, ApiNavigationConfigRootSchema, SnippetsConfigSchema } from "../register/index";
import { TypeDefinitionSchema } from "../register/type";
import { WebhookDefinitionSchema } from "../register/webhook";
import { WebSocketChannelSchema } from "../register/websocket";
import { DbEndpointDefinitionSchema } from "./endpoint";

export const DbApiDefinitionPackageSchema = z.object({
    endpoints: z.array(DbEndpointDefinitionSchema),
    websockets: z.array(WebSocketChannelSchema).nullish(),
    webhooks: z.array(WebhookDefinitionSchema).nullish(),
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
    types: z.record(TypeIdSchema, TypeDefinitionSchema),
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

export * from "./endpoint";
