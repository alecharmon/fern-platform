// Re-export branded types + const objects from oRPC shared

// Re-export latest types with non-prefixed aliases for backward compatibility
export {
    type LatestApiDefinition as ApiDefinition,
    LatestApiDefinitionSchema as ApiDefinitionSchema,
    type LatestAuthScheme as AuthScheme,
    LatestAuthSchemeSchema as AuthSchemeSchema,
    type LatestBytesRequest as BytesRequest,
    LatestBytesRequestSchema as BytesRequestSchema,
    type LatestCodeSnippet as CodeSnippet,
    LatestCodeSnippetSchema as CodeSnippetSchema,
    type LatestContentType as ContentType,
    LatestContentTypeSchema as ContentTypeSchema,
    type LatestDiscriminatedUnionType as DiscriminatedUnionType,
    LatestDiscriminatedUnionTypeSchema as DiscriminatedUnionTypeSchema,
    type LatestDiscriminatedUnionVariant as DiscriminatedUnionVariant,
    LatestDiscriminatedUnionVariantSchema as DiscriminatedUnionVariantSchema,
    type LatestEndpointDefinition as EndpointDefinition,
    LatestEndpointDefinitionSchema as EndpointDefinitionSchema,
    type LatestEnumType as EnumType,
    LatestEnumTypeSchema as EnumTypeSchema,
    type LatestEnumValue as EnumValue,
    LatestEnumValueSchema as EnumValueSchema,
    type LatestErrorExample as ErrorExample,
    LatestErrorExampleSchema as ErrorExampleSchema,
    type LatestErrorResponse as ErrorResponse,
    LatestErrorResponseSchema as ErrorResponseSchema,
    type LatestExampleEndpointCall as ExampleEndpointCall,
    LatestExampleEndpointCallSchema as ExampleEndpointCallSchema,
    type LatestExampleEndpointRequest as ExampleEndpointRequest,
    LatestExampleEndpointRequestSchema as ExampleEndpointRequestSchema,
    type LatestExampleEndpointResponse as ExampleEndpointResponse,
    LatestExampleEndpointResponseSchema as ExampleEndpointResponseSchema,
    type LatestExampleErrorResponse as ExampleErrorResponse,
    LatestExampleErrorResponseSchema as ExampleErrorResponseSchema,
    type LatestExampleWebhookPayload as ExampleWebhookPayload,
    LatestExampleWebhookPayloadSchema as ExampleWebhookPayloadSchema,
    type LatestExampleWebSocketMessage as ExampleWebSocketMessage,
    LatestExampleWebSocketMessageSchema as ExampleWebSocketMessageSchema,
    type LatestExampleWebSocketSession as ExampleWebSocketSession,
    LatestExampleWebSocketSessionSchema as ExampleWebSocketSessionSchema,
    type LatestFileDownloadResponseBodyShape as FileDownloadResponseBodyShape,
    LatestFileDownloadResponseBodyShapeSchema as FileDownloadResponseBodyShapeSchema,
    type LatestFormDataField as FormDataField,
    type LatestFormDataFile as FormDataFile,
    type LatestFormDataFiles as FormDataFiles,
    LatestFormDataPropertySchema as FormDataPropertySchema,
    type LatestFormDataPropertyVariant as FormDataPropertyVariant,
    type LatestFormDataRequest as FormDataRequest,
    LatestFormDataRequestSchema as FormDataRequestSchema,
    type LatestGraphQlArgument as GraphQlArgument,
    LatestGraphQlArgumentSchema as GraphQlArgumentSchema,
    type LatestGraphQlExample as GraphQlExample,
    LatestGraphQlExampleSchema as GraphQlExampleSchema,
    type LatestGraphQlOperation as GraphQlOperation,
    LatestGraphQlOperationSchema as GraphQlOperationSchema,
    type LatestGraphQlOperationType as GraphQlOperationType,
    LatestGraphQlOperationTypeSchema as GraphQlOperationTypeSchema,
    type LatestHttpRequest as HttpRequest,
    type LatestHttpRequestBodyShape as HttpRequestBodyShape,
    LatestHttpRequestBodyShapeSchema as HttpRequestBodyShapeSchema,
    LatestHttpRequestSchema as HttpRequestSchema,
    type LatestHttpResponse as HttpResponse,
    type LatestHttpResponseBodyShape as HttpResponseBodyShape,
    LatestHttpResponseBodyShapeSchema as HttpResponseBodyShapeSchema,
    LatestHttpResponseSchema as HttpResponseSchema,
    type LatestLanguage as Language,
    LatestLanguageSchema as LanguageSchema,
    type LatestLiteralType as LiteralType,
    LatestLiteralTypeSchema as LiteralTypeSchema,
    type LatestObjectProperty as ObjectProperty,
    type LatestObjectPropertyAccess as ObjectPropertyAccess,
    LatestObjectPropertyAccessSchema as ObjectPropertyAccessSchema,
    LatestObjectPropertySchema as ObjectPropertySchema,
    type LatestObjectType as ObjectType,
    LatestObjectTypeSchema as ObjectTypeSchema,
    type LatestParameterProperty as ParameterProperty,
    LatestParameterPropertySchema as ParameterPropertySchema,
    type LatestPrimitiveType as PrimitiveType,
    LatestPrimitiveTypeSchema as PrimitiveTypeSchema,
    type LatestStreamResponse as StreamResponse,
    LatestStreamResponseSchema as StreamResponseSchema,
    type LatestSubpackageMetadata as SubpackageMetadata,
    LatestSubpackageMetadataSchema as SubpackageMetadataSchema,
    type LatestTypeDefinition as TypeDefinition,
    LatestTypeDefinitionSchema as TypeDefinitionSchema,
    type LatestTypeReference as TypeReference,
    type LatestTypeReferenceIdDefault as TypeReferenceIdDefault,
    LatestTypeReferenceIdDefaultSchema as TypeReferenceIdDefaultSchema,
    LatestTypeReferenceSchema as TypeReferenceSchema,
    type LatestTypeShape as TypeShape,
    LatestTypeShapeSchema as TypeShapeSchema,
    type LatestUndiscriminatedUnionType as UndiscriminatedUnionType,
    LatestUndiscriminatedUnionTypeSchema as UndiscriminatedUnionTypeSchema,
    type LatestUndiscriminatedUnionVariant as UndiscriminatedUnionVariant,
    LatestUndiscriminatedUnionVariantSchema as UndiscriminatedUnionVariantSchema,
    type LatestUnknownType as UnknownType,
    LatestUnknownTypeSchema as UnknownTypeSchema,
    type LatestWebhookDefinition as WebhookDefinition,
    LatestWebhookDefinitionSchema as WebhookDefinitionSchema,
    type LatestWebhookPayload as WebhookPayload,
    LatestWebhookPayloadSchema as WebhookPayloadSchema,
    type LatestWebhookPayloadShape as WebhookPayloadShape,
    LatestWebhookPayloadShapeSchema as WebhookPayloadShapeSchema,
    type LatestWebSocketChannel as WebSocketChannel,
    LatestWebSocketChannelSchema as WebSocketChannelSchema,
    type LatestWebSocketMessage as WebSocketMessage,
    LatestWebSocketMessageSchema as WebSocketMessageSchema,
    type PathPart,
    PathPartSchema,
    type WithNamespace,
    WithNamespaceSchema
} from "../orpc-client/api/contract-latest.js";

// Re-export all types from api/shared (includes AvailabilitySchema, TypeReference, etc.)
export * from "../orpc-client/api/shared.js";
export {
    ApiDefinitionId,
    ApiDefinitionIdSchema,
    Availability,
    EndpointPathLiteral,
    EndpointPathLiteralSchema,
    GrpcId,
    GrpcIdSchema,
    GrpcMethod,
    HttpSnippetLanguage,
    type OrgId,
    OrgIdSchema,
    SupportedLanguage
} from "../orpc-client/shared.js";

// ── Namespace re-exports for backward compatibility ──────────────────────────
// The old generated code provided these as namespaces with sub-types.
// Consumers use patterns like `FormDataField.File_`, `PathPart.Literal`, etc.

import type {
    LatestFormDataFile,
    LatestFormDataFiles,
    LatestFormDataPropertyVariant,
    LatestHttpRequestBodyShape,
    LatestHttpResponseBodyShape
} from "../orpc-client/api/contract-latest.js";

export declare namespace FormDataField {
    export type File_ = LatestFormDataFile;
    export type Files = LatestFormDataFiles;
    export type Property = LatestFormDataPropertyVariant;
}

export declare namespace PathPart {
    export interface Literal {
        type: "literal";
        value: string;
    }
    export interface PathParameter {
        type: "pathParameter";
        value: string;
    }
}

export declare namespace HttpRequestBodyShape {
    export type Object = Extract<LatestHttpRequestBodyShape, { type: "object" }>;
    export type Alias = Extract<LatestHttpRequestBodyShape, { type: "alias" }>;
    export type Bytes = Extract<LatestHttpRequestBodyShape, { type: "bytes" }>;
    export type FormData = Extract<LatestHttpRequestBodyShape, { type: "formData" }>;
}

export declare namespace HttpResponseBodyShape {
    export type Empty = Extract<LatestHttpResponseBodyShape, { type: "empty" }>;
    export type Object = Extract<LatestHttpResponseBodyShape, { type: "object" }>;
    export type Alias = Extract<LatestHttpResponseBodyShape, { type: "alias" }>;
    export type FileDownload = Extract<LatestHttpResponseBodyShape, { type: "fileDownload" }>;
    export type StreamingText = Extract<LatestHttpResponseBodyShape, { type: "streamingText" }>;
    export type Stream = Extract<LatestHttpResponseBodyShape, { type: "stream" }>;
}
