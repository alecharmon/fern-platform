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
