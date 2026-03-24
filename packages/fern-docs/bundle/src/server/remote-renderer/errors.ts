/**
 * Base class for errors caused by customer content issues (e.g., unsupported JSX tags,
 * missing endpoint references, invalid MDX syntax). These are NOT Fern platform bugs.
 *
 * Use `instanceof ClientContentError` at logging boundaries to downgrade severity
 * from `error` to `warn` and tag with `error_category: "client_content"` for filtering.
 */
export class ClientContentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ClientContentError";
    }
}

/**
 * Thrown when a JSX tag used in customer MDX content is not supported by Fern.
 * For example, `<Danger />` is a Docusaurus admonition type that Fern does not support.
 * This is a customer content issue, not a Fern bug.
 */
export class UnsupportedJsxTagError extends ClientContentError {
    constructor(tag: string) {
        super(`Unsupported JSX tag: <${tag} />`);
        this.name = "UnsupportedJsxTagError";
    }
}

/**
 * Thrown when an endpoint reference was detected in MDX content,
 * but the endpoint does not exist in the customer's API definition.
 * This is a customer content issue, not a Fern bug.
 */
export class EndpointNotInApiError extends Error {
    constructor(method: string, path: string, apiName?: string, example?: string) {
        super(
            `Endpoint ${method} ${path}${apiName ? ` (api: ${apiName})` : ""}${example ? ` (example: ${example})` : ""} does not exist in the API definition. ` +
                `The endpoint reference was detected in the MDX content, but the bundle server's loader could not find a matching endpoint.`
        );
        this.name = "EndpointNotInApiError";
    }
}

/**
 * Thrown when types for a given API name were not found in the pre-resolved data.
 * This typically means the API definition referenced in MDX content (e.g., via a
 * Merge widget's gzip data) does not exist or could not be fetched from FDR.
 * This is a customer content issue, not a Fern bug.
 */
export class TypesNotInApiError extends Error {
    constructor(apiName?: string) {
        super(
            `Types for API "${apiName ?? "(default)"}" not found in pre-resolved data. ` +
                `The API name was detected in the MDX content, but the bundle server's loader could not resolve its types.`
        );
        this.name = "TypesNotInApiError";
    }
}
