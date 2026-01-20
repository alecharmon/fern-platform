import { HttpMethod } from "@fern-api/docs-utils";
import type { EndpointDefinition, ErrorResponse } from "@fern-api/fdr-sdk/api-definition";
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
    const urlToReplace = endpoint.environments?.find((env) => requestCodeSnippet.includes(env.baseUrl))?.baseUrl;

    let resolvedBaseUrl = baseUrl;
    if (resolvedBaseUrl?.endsWith("/")) {
        resolvedBaseUrl = resolvedBaseUrl.replace(/\/$/, "");
    }

    return urlToReplace && resolvedBaseUrl
        ? requestCodeSnippet.replace(urlToReplace, resolvedBaseUrl)
        : requestCodeSnippet;
}
