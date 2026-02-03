import { HttpMethod } from "@fern-api/docs-utils";
import type { EndpointDefinition, ErrorResponse } from "@fern-api/fdr-sdk/api-definition";
import { sanitizeUrl } from "@fern-api/ui-core-utils";
import { camelCase, upperFirst } from "es-toolkit/string";

export function getErrorByStatusCode(errors: ErrorResponse[] | undefined): Record<number, ErrorResponse> {
    const map: Record<number, ErrorResponse> = {};
    errors?.forEach((error) => {
        map[error.statusCode] = error;
    });
    return map;
}

export function convertNameToAnchorPart(name: string | null | undefined): string | undefined {
    if (name == null) {
        return undefined;
    }
    return upperFirst(camelCase(name));
}

export function extractMethodAndPath(endpoint: string): { method: HttpMethod; path: string } | undefined {
    const [maybeMethod, path] = endpoint.trim().split(" ");

    // parse method into APIV1Read.HttpMethod
    let method: HttpMethod | undefined;

    if (maybeMethod != null) {
        method = maybeMethod.toUpperCase() as HttpMethod;
    }

    // ensure that method is a valid HTTP method
    if (method == null || !HttpMethod[method] || path == null) {
        return undefined;
    }

    return { method, path };
}

export function resolveEnvironmentUrlInCodeSnippet(
    endpoint: EndpointDefinition,
    requestCodeSnippet: string,
    baseUrl: string | undefined
): string {
    // Try to find a URL to replace by checking both original and sanitized versions
    let urlToReplace: string | undefined = undefined;

    for (const env of endpoint.environments ?? []) {
        // Check exact match first
        if (requestCodeSnippet.includes(env.baseUrl)) {
            urlToReplace = env.baseUrl;
            break;
        }

        // Also check sanitized (lowercased) version since snippets might be pre-sanitized
        const sanitizedEnvUrl = sanitizeUrl(env.baseUrl);
        if (sanitizedEnvUrl && requestCodeSnippet.includes(sanitizedEnvUrl)) {
            urlToReplace = sanitizedEnvUrl;
            break;
        }
    }

    let resolvedBaseUrl = baseUrl;
    if (resolvedBaseUrl?.endsWith("/")) {
        resolvedBaseUrl = resolvedBaseUrl.replace(/\/$/, "");
    }

    // Also remove trailing slash from urlToReplace to ensure consistent replacement
    if (urlToReplace?.endsWith("/")) {
        urlToReplace = urlToReplace.replace(/\/$/, "");
    }

    if (urlToReplace && resolvedBaseUrl) {
        return requestCodeSnippet.replaceAll(urlToReplace, resolvedBaseUrl);
    }
    return requestCodeSnippet;
}
