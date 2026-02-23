import type { ApiDefinition as _LatestApiDefinition } from "./controllers/api/latest";
import type { ApiDefinition as _V1ReadApiDefinition } from "./controllers/api/read";
import type {
    HttpMethod as _HttpMethod,
    SubpackageId as _SubpackageId,
    TypeReference as _TypeReference
} from "./controllers/api/shared";

export type { EndpointSnippetTemplates } from "./controllers/api/db/endpoint";

export type { ApiId, JqString, OrgId } from "./controllers/api/register/commons";
export type {
    ApiDefinitionId,
    AuthSchemeId,
    Availability,
    EndpointId,
    EnvironmentId,
    FileId,
    GraphQlOperationId,
    GrpcMethod,
    HttpMethod,
    MultipleAuthType,
    PropertyKey,
    TypeId,
    WebhookId,
    WebSocketId
} from "./controllers/api/shared";

export type { DocsConfigId } from "./controllers/docs/v1/read/commons";
export type { LinkTarget, PageId, RoleId, Url, VersionId } from "./controllers/docs/v1/shared";

export type EndpointPathLiteral = string;

export interface EndpointIdentifier {
    path: string;
    method: _HttpMethod;
    identifierOverride?: string | null;
}

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
