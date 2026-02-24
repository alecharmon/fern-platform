export * as DocsV2Read from "../orpc-client/docs/v2/read/contract.js";
export * as DocsV2Write from "../orpc-client/docs/v2/write/contract.js";
export * as Snippets from "../orpc-client/snippets/contract.js";
export * as APIV1Db from "./APIV1Db";
export * as APIV1Read from "./APIV1Read";
export * as APIV1Write from "./APIV1Write";
export * as DocsV1Db from "./DocsV1Db";
export * as DocsV1Read from "./DocsV1Read";
export * as DocsV1Write from "./DocsV1Write";
export * as FdrAPI from "./FdrAPI";

/**
 * The response of an API call.
 * It is a successful response or a failed response.
 */
export type APIResponse<Success, Failure> = SuccessfulResponse<Success> | FailedResponse<Failure>;

export interface SuccessfulResponse<T> {
    ok: true;
    body: T;
}

export interface FailedResponse<T> {
    ok: false;
    error: T;
}
