import * as z from "zod";

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
import { EndpointDefinitionSchema, HeaderSchema } from "./endpoint";
import { GraphQlOperationSchema } from "./graphql";
import { TypeDefinitionSchema } from "./type";
import { WebhookDefinitionSchema } from "./webhook";
import { WebSocketChannelSchema } from "./websocket";

export const SourceIdSchema = z.string();
export type SourceId = z.infer<typeof SourceIdSchema>;

export const SourceSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("openapi") }),
    z.object({ type: z.literal("asyncapi") }),
    z.object({ type: z.literal("proto") })
]);
export type Source = z.infer<typeof SourceSchema>;

export const SourceUploadSchema = z.object({
    uploadUrl: z.string(),
    downloadUrl: z.string()
});
export type SourceUpload = z.infer<typeof SourceUploadSchema>;

export const DynamicIRSchema = z.object({
    dynamicIR: z.unknown()
});
export type DynamicIR = z.infer<typeof DynamicIRSchema>;

export const DynamicIRUploadSchema = z.object({
    uploadUrl: z.string()
});
export type DynamicIRUpload = z.infer<typeof DynamicIRUploadSchema>;

export const TypescriptPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type TypescriptPackage = z.infer<typeof TypescriptPackageSchema>;

export const PythonPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type PythonPackage = z.infer<typeof PythonPackageSchema>;

export const GoModuleSchema = z.object({
    githubRepo: z.string(),
    version: z.string().nullish()
});
export type GoModule = z.infer<typeof GoModuleSchema>;

export const JavaCoordinateSchema = z.object({
    coordinate: z.string(),
    version: z.string().nullish()
});
export type JavaCoordinate = z.infer<typeof JavaCoordinateSchema>;

export const RubyGemSchema = z.object({
    gem: z.string(),
    version: z.string().nullish()
});
export type RubyGem = z.infer<typeof RubyGemSchema>;

export const NugetPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type NugetPackage = z.infer<typeof NugetPackageSchema>;

export const ComposerPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type ComposerPackage = z.infer<typeof ComposerPackageSchema>;

export const SwiftPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type SwiftPackage = z.infer<typeof SwiftPackageSchema>;

export const CratesPackageSchema = z.object({
    package: z.string(),
    version: z.string().nullish()
});
export type CratesPackage = z.infer<typeof CratesPackageSchema>;

export const SnippetsConfigSchema = z.object({
    typescriptSdk: TypescriptPackageSchema.nullish(),
    pythonSdk: PythonPackageSchema.nullish(),
    goSdk: GoModuleSchema.nullish(),
    javaSdk: JavaCoordinateSchema.nullish(),
    rubySdk: RubyGemSchema.nullish(),
    csharpSdk: NugetPackageSchema.nullish(),
    phpSdk: ComposerPackageSchema.nullish(),
    swiftSdk: SwiftPackageSchema.nullish(),
    rustSdk: CratesPackageSchema.nullish()
});
export type SnippetsConfig = z.infer<typeof SnippetsConfigSchema>;

export const BearerAuthSchema = z.object({
    description: z.string().nullish(),
    tokenName: z.string().nullish()
});
export type BearerAuth = z.infer<typeof BearerAuthSchema>;

export const BasicAuthSchema = z.object({
    description: z.string().nullish(),
    usernameName: z.string().nullish(),
    passwordName: z.string().nullish(),
    passwordAlwaysEmpty: z.boolean().nullish()
});
export type BasicAuth = z.infer<typeof BasicAuthSchema>;

export const HeaderAuthSchema = z.object({
    description: z.string().nullish(),
    nameOverride: z.string().nullish(),
    headerWireValue: z.string(),
    prefix: z.string().nullish()
});
export type HeaderAuth = z.infer<typeof HeaderAuthSchema>;

export const OAuthClientCredentialsReferencedEndpointSchema = z.object({
    description: z.string().nullish(),
    endpointId: EndpointIdSchema,
    accessTokenLocator: z.string(),
    headerName: z.string().nullish(),
    tokenPrefix: z.string().nullish()
});
export type OAuthClientCredentialsReferencedEndpoint = z.infer<typeof OAuthClientCredentialsReferencedEndpointSchema>;

export const OAuthClientCredentialsSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("referencedEndpoint"),
        ...OAuthClientCredentialsReferencedEndpointSchema.shape
    })
]);
export type OAuthClientCredentials = z.infer<typeof OAuthClientCredentialsSchema>;

export const OAuthSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("clientCredentials"), value: OAuthClientCredentialsSchema })
]);
export type OAuth = z.infer<typeof OAuthSchema>;

export const ApiAuthSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearerAuth"), ...BearerAuthSchema.shape }),
    z.object({ type: z.literal("basicAuth"), ...BasicAuthSchema.shape }),
    z.object({ type: z.literal("header"), ...HeaderAuthSchema.shape }),
    z.object({ type: z.literal("oAuth"), value: OAuthSchema })
]);
export type ApiAuth = z.infer<typeof ApiAuthSchema>;

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
    websockets: z.array(WebSocketChannelSchema).nullish(),
    webhooks: z.array(WebhookDefinitionSchema).nullish(),
    graphqlOperations: z.array(GraphQlOperationSchema).nullish(),
    types: z.array(TypeIdSchema),
    subpackages: z.array(SubpackageIdSchema),
    pointsTo: SubpackageIdSchema.nullish()
});
export type ApiDefinitionPackage = z.infer<typeof ApiDefinitionPackageSchema>;

export const ApiDefinitionSubpackageSchema = z.object({
    ...ApiDefinitionPackageSchema.shape,
    description: z.string().nullish(),
    subpackageId: SubpackageIdSchema,
    name: z.string(),
    displayName: z.string().nullish()
});
export type ApiDefinitionSubpackage = z.infer<typeof ApiDefinitionSubpackageSchema>;

export const ApiDefinitionSchema = z.object({
    rootPackage: ApiDefinitionPackageSchema,
    apiName: z.string().nullish(),
    types: z.record(TypeIdSchema, TypeDefinitionSchema),
    subpackages: z.record(SubpackageIdSchema, ApiDefinitionSubpackageSchema),
    auth: ApiAuthSchema.nullish(),
    authSchemes: z.record(AuthSchemeIdSchema, ApiAuthSchema).nullish(),
    globalHeaders: z.array(HeaderSchema).nullish(),
    snippetsConfiguration: SnippetsConfigSchema.nullish(),
    navigation: ApiNavigationConfigRootSchema.nullish()
});
export type ApiDefinition = z.infer<typeof ApiDefinitionSchema>;

export const RegisterApiDefinitionResponseSchema = z.object({
    apiDefinitionId: ApiDefinitionIdSchema,
    sources: z.record(SourceIdSchema, SourceUploadSchema).nullish(),
    dynamicIRs: z.record(z.string(), DynamicIRUploadSchema).nullish()
});
export type RegisterApiDefinitionResponse = z.infer<typeof RegisterApiDefinitionResponseSchema>;

export const SnippetInfoSchema = z.object({
    packageName: z.string(),
    version: z.string().nullish()
});
export type SnippetInfo = z.infer<typeof SnippetInfoSchema>;

export const SdkDynamicIrDownloadSchema = z.object({
    downloadUrl: z.string()
});
export type SdkDynamicIrDownload = z.infer<typeof SdkDynamicIrDownloadSchema>;

export const GetSdkDynamicIrUploadUrlsResponseSchema = z.object({
    uploadUrls: z.record(z.string(), DynamicIRUploadSchema)
});
export type GetSdkDynamicIrUploadUrlsResponse = z.infer<typeof GetSdkDynamicIrUploadUrlsResponseSchema>;

export const CheckSdkDynamicIrExistsResponseSchema = z.object({
    existingDynamicIrs: z.record(z.string(), SdkDynamicIrDownloadSchema)
});
export type CheckSdkDynamicIrExistsResponse = z.infer<typeof CheckSdkDynamicIrExistsResponseSchema>;

export const EndpointExampleGenerationErrorBodySchema = z.object({
    endpointId: z.string()
});
export type EndpointExampleGenerationErrorBody = z.infer<typeof EndpointExampleGenerationErrorBodySchema>;

export * from "./commons";
export * from "./endpoint";
export * from "./graphql";
export * from "./type";
export * from "./webhook";
export * from "./websocket";
