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
