// Flat re-exports (all types available directly as FdrAPI.*)
export * from "../orpc-client/api/contract-db.js";
export * from "../orpc-client/api/contract-latest.js";
export * from "../orpc-client/api/contract-read.js";
export * from "../orpc-client/api/contract-register.js";
export * from "../orpc-client/api/shared.js";
export * from "../orpc-client/shared.js";

// Re-export types from oRPC sub-contracts that consumers use as FdrAPI.*
export { type SdkSnippetsCreate } from "../orpc-client/snippets/contract.js";
export {
    type EndpointSnippetTemplate as EndpointSnippetTemplateRaw,
    EndpointSnippetTemplateSchema,
    type RegisterBatchInput as RegisterSnippetTemplateBatchRequest,
    RegisterBatchInputSchema as RegisterSnippetTemplateBatchRequestSchema,
    type SnippetRegistryEntry,
    SnippetRegistryEntrySchema
} from "../orpc-client/templates/contract.js";

/**
 * Full endpoint snippet template object returned from loadSnippetTemplate.
 * This extends beyond the raw EndpointSnippetTemplate (Record<string, unknown>)
 * to include all metadata fields used by the server.
 */
export interface EndpointSnippetTemplate {
    apiDefinitionId: string;
    endpointId: {
        path: string;
        method: import("../orpc-client/shared.js").HttpMethod;
        identifierOverride: string | undefined;
    };
    sdk: import("../orpc-client/shared.js").Sdk;
    snippetTemplate: {
        type: "v1";
        functionInvocation: unknown;
        clientInstantiation: string;
    };
    additionalTemplates: Record<string, unknown> | undefined;
}

import * as _ApiLatest from "../orpc-client/api/contract-latest.js";
import * as _DocsV2Read from "../orpc-client/docs/v2/read/contract.js";
import * as _DocsV2Write from "../orpc-client/docs/v2/write/contract.js";
import * as _APIV1Db from "./APIV1Db";
// Namespace re-exports for backward compatibility with generated code structure
// Downstream packages use patterns like FdrAPI.docs.v2.read.LoadDocsForUrlResponse
import * as _APIV1Read from "./APIV1Read";
import * as _APIV1Write from "./APIV1Write";
import * as _DocsV1Db from "./DocsV1Db";
import * as _DocsV1Read from "./DocsV1Read";
import * as _DocsV1Write from "./DocsV1Write";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace docs {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    export namespace v1 {
        export import read = _DocsV1Read;
        export import db = _DocsV1Db;
        export import write = _DocsV1Write;
    }
    // eslint-disable-next-line @typescript-eslint/no-namespace
    export namespace v2 {
        export import read = _DocsV2Read;
        export import write = _DocsV2Write;
    }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace api {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    export namespace v1 {
        export import read = _APIV1Read;
        export import db = _APIV1Db;
        export import register = _APIV1Write;
    }
    export import latest = _ApiLatest;
}
