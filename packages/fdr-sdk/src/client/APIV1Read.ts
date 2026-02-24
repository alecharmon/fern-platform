// Re-export types from contract-db that consumers depend on
export { type EndpointSnippetTemplates, EndpointSnippetTemplatesSchema } from "../orpc-client/api/contract-db.js";
export * from "../orpc-client/api/contract-read.js";
// Backward-compatible type aliases (Read-prefixed → unprefixed)
export {
    type ReadApiDefinition as ApiDefinition,
    type ReadApiDefinitionPackage as ApiDefinitionPackage,
    ReadApiDefinitionPackageSchema as ApiDefinitionPackageSchema,
    ReadApiDefinitionSchema as ApiDefinitionSchema,
    type ReadApiDefinitionSubpackage as ApiDefinitionSubpackage,
    ReadApiDefinitionSubpackageSchema as ApiDefinitionSubpackageSchema,
    type ReadBytesRequest as BytesRequest,
    ReadBytesRequestSchema as BytesRequestSchema,
    type ReadCodeExamples as CodeExamples,
    ReadCodeExamplesSchema as CodeExamplesSchema,
    type ReadCsharpSnippet as CsharpSnippet,
    ReadCsharpSnippetSchema as CsharpSnippetSchema,
    type ReadCustomCodeSample as CustomCodeSample,
    ReadCustomCodeSampleSchema as CustomCodeSampleSchema,
    type ReadEndpointDefinition as EndpointDefinition,
    ReadEndpointDefinitionSchema as EndpointDefinitionSchema,
    type ReadErrorDeclarationV2 as ErrorDeclarationV2,
    ReadErrorDeclarationV2Schema as ErrorDeclarationV2Schema,
    type ReadExampleEndpointCall as ExampleEndpointCall,
    ReadExampleEndpointCallSchema as ExampleEndpointCallSchema,
    type ReadGoSnippet as GoSnippet,
    ReadGoSnippetSchema as GoSnippetSchema,
    type ReadHttpRequest as HttpRequest,
    type ReadHttpRequestBodyShape as HttpRequestBodyShape,
    ReadHttpRequestBodyShapeSchema as HttpRequestBodyShapeSchema,
    ReadHttpRequestSchema as HttpRequestSchema,
    type ReadHttpRequestsV2 as HttpRequestsV2,
    ReadHttpRequestsV2Schema as HttpRequestsV2Schema,
    type ReadHttpResponse as HttpResponse,
    type ReadHttpResponseBodyShape as HttpResponseBodyShape,
    ReadHttpResponseBodyShapeSchema as HttpResponseBodyShapeSchema,
    ReadHttpResponseSchema as HttpResponseSchema,
    type ReadHttpResponsesV2 as HttpResponsesV2,
    ReadHttpResponsesV2Schema as HttpResponsesV2Schema,
    type ReadLanguage as Language,
    ReadLanguageSchema as LanguageSchema,
    type ReadNonStreamResponse as NonStreamResponse,
    ReadNonStreamResponseSchema as NonStreamResponseSchema,
    type ReadPythonSnippet as PythonSnippet,
    ReadPythonSnippetSchema as PythonSnippetSchema,
    type ReadRubySnippet as RubySnippet,
    ReadRubySnippetSchema as RubySnippetSchema,
    type ReadStreamConditionResponse as StreamConditionResponse,
    ReadStreamConditionResponseSchema as StreamConditionResponseSchema,
    type ReadStreamResponse as StreamResponse,
    ReadStreamResponseSchema as StreamResponseSchema,
    type ReadSupportedLanguage as SupportedLanguage,
    ReadSupportedLanguageSchema as SupportedLanguageSchema,
    type ReadTypeDefinition as TypeDefinition,
    ReadTypeDefinitionSchema as TypeDefinitionSchema,
    type ReadTypeShape as TypeShape,
    ReadTypeShapeSchema as TypeShapeSchema,
    type ReadTypescriptSnippet as TypescriptSnippet,
    ReadTypescriptSnippetSchema as TypescriptSnippetSchema,
    type ReadUndiscriminatedUnionType as UndiscriminatedUnionType,
    ReadUndiscriminatedUnionTypeSchema as UndiscriminatedUnionTypeSchema,
    type ReadUndiscriminatedUnionVariant as UndiscriminatedUnionVariant,
    ReadUndiscriminatedUnionVariantSchema as UndiscriminatedUnionVariantSchema,
    type ReadWebhookDefinition as WebhookDefinition,
    ReadWebhookDefinitionSchema as WebhookDefinitionSchema,
    type ReadWebSocketChannel as WebSocketChannel,
    ReadWebSocketChannelSchema as WebSocketChannelSchema
} from "../orpc-client/api/contract-read.js";
export * from "../orpc-client/api/contract-register.js";
export * from "../orpc-client/api/shared.js";
// Re-export GrpcMethod and Availability from shared (const objects for value access like GrpcMethod.Unary, Availability.Stable)
export { Availability, GrpcMethod } from "../orpc-client/shared.js";

// Namespace re-exports for backward compatibility
import type { OAuthClientCredentialsReferencedEndpoint } from "../orpc-client/api/shared.js";
export declare namespace OAuthClientCredentials {
    export type ReferencedEndpoint = OAuthClientCredentialsReferencedEndpoint;
}

// Const value object for WebSocketMessageOrigin (consumers use APIV1Read.WebSocketMessageOrigin.Client, etc.)
export const WebSocketMessageOrigin = {
    Client: "client",
    Server: "server"
} as const;

export type WebSocketMessageOrigin = (typeof WebSocketMessageOrigin)[keyof typeof WebSocketMessageOrigin];
