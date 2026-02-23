import type {
    LatestApiDefinition as _LatestApiDefinition,
    SubpackageId as _SubpackageId,
    TypeReference as _TypeReference,
    ReadApiDefinition as _V1ReadApiDefinition
} from "@fern-api/fdr-sdk/orpc-client";

export type {
    ApiDefinitionId,
    ApiId,
    AuthSchemeId,
    Availability,
    EndpointId,
    EndpointIdentifier,
    EndpointPathLiteral,
    EndpointSnippetTemplates,
    EnvironmentId,
    FileId,
    GraphQlOperationId,
    GrpcMethod,
    HttpMethod,
    JqString,
    MultipleAuthType,
    OrgId,
    PropertyKey,
    TypeId,
    WebhookId,
    WebSocketId
} from "@fern-api/fdr-sdk/orpc-client";

export type { DocsConfigId } from "./controllers/docs/v1/read/commons";
export type { LinkTarget, PageId, RoleId, Url, VersionId } from "./controllers/docs/v1/shared";

export type Sdk =
    | { type: "typescript"; package: string; version: string }
    | { type: "python"; package: string; version: string }
    | { type: "go"; githubRepo: string; version: string }
    | { type: "ruby"; gem: string; version: string }
    | { type: "java"; group: string; artifact: string; version: string }
    | { type: "csharp"; package: string; version: string };

export type SdkRequest =
    | { type: "typescript"; package: string; version: string | undefined }
    | { type: "python"; package: string; version: string | undefined }
    | { type: "go"; githubRepo: string; version: string | undefined }
    | { type: "ruby"; gem: string; version: string | undefined }
    | { type: "java"; group: string; artifact: string; version: string | undefined }
    | { type: "csharp"; package: string; version: string | undefined };

export namespace api {
    export namespace v1 {
        export type SubpackageId = _SubpackageId;
        export namespace read {
            export type TypeReference = _TypeReference;
            export type ApiDefinition = _V1ReadApiDefinition;
        }
    }
    export namespace latest {
        export type ApiDefinition = _LatestApiDefinition;
    }
}
