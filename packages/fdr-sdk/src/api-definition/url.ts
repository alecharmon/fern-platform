import { sanitizeUrl, unknownToString } from "@fern-api/ui-core-utils";
import qs from "qs";

import type { EndpointDefinition, ParameterProperty, PathPart } from "./latest";

/**
 * Preprocesses query parameters based on explode metadata.
 * When explode=false, arrays are joined with commas instead of being repeated.
 */
export function preprocessQueryParameters(
    queryParameters: Record<string, unknown> | undefined,
    parameterMetadata: ParameterProperty[] | undefined
): Record<string, unknown> | undefined {
    if (queryParameters == null) {
        return undefined;
    }

    // If no metadata, return as-is (default behavior is explode=true)
    if (parameterMetadata == null || parameterMetadata.length === 0) {
        return queryParameters;
    }

    // Create a map of parameter key to explode setting
    const explodeMap = new Map<string, boolean | undefined>();
    for (const param of parameterMetadata) {
        explodeMap.set(param.key, param.explode);
    }

    // Process each query parameter
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(queryParameters)) {
        const explode = explodeMap.get(key);

        // If explode is explicitly false and value is an array, join with commas
        if (explode === false && Array.isArray(value)) {
            result[key] = value.map((v) => unknownToString(v)).join(",");
        } else {
            result[key] = value;
        }
    }

    return result;
}

function buildQueryParams(queryParameters: Record<string, unknown> | undefined): string {
    if (queryParameters == null) {
        return "";
    }

    const filteredParams = Object.entries(queryParameters).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (value != null) {
            acc[key] = value;
        }
        return acc;
    }, {});

    if (Object.keys(filteredParams).length === 0) {
        return "";
    }

    const queryString = qs.stringify(filteredParams, {
        encode: false,
        arrayFormat: "repeat",
        skipNulls: true,
        serializeDate: (date: Date) => date.toISOString()
    });

    return queryString ? "?" + queryString : "";
}

function buildPath(path: PathPart[] = [], pathParameters?: Record<string, unknown>): string {
    return path
        .map((part) => {
            if (part.type === "pathParameter") {
                const key = part.value;
                const stateValue = unknownToString(pathParameters?.[key]);
                return stateValue.length > 0 ? encodeURIComponent(stateValue) : ":" + key;
            }
            return part.value;
        })
        .join("");
}

interface BuildRequestUrlOptions {
    path?: PathPart[];
    pathParameters?: Record<string, unknown>;
    queryParameters?: Record<string, unknown>;
    baseUrl?: string;
}
export function buildRequestUrl({
    baseUrl = "",
    path,
    pathParameters,
    queryParameters
}: BuildRequestUrlOptions): string {
    const sanitizedBaseUrl = sanitizeUrl(baseUrl) || "";

    if (sanitizedBaseUrl.endsWith("/")) {
        return sanitizedBaseUrl.slice(0, -1) + buildPath(path, pathParameters) + buildQueryParams(queryParameters);
    }
    return sanitizedBaseUrl + buildPath(path, pathParameters) + buildQueryParams(queryParameters);
}

interface BuildEndpointUrlOptions {
    endpoint?: EndpointDefinition;
    pathParameters?: Record<string, unknown>;
    queryParameters?: Record<string, unknown>;
    baseUrl?: string;
}
export function buildEndpointUrl({
    endpoint,
    pathParameters,
    queryParameters,
    baseUrl
}: BuildEndpointUrlOptions): string {
    const environmentBaseUrl =
        baseUrl ??
        (endpoint?.environments?.find((env) => env.id === endpoint.defaultEnvironment) ?? endpoint?.environments?.[0])
            ?.baseUrl;

    // sanitize the base URL - if invalid, it will be null
    const sanitizedBaseUrl = sanitizeUrl(environmentBaseUrl);

    // Preprocess query parameters based on explode metadata
    const processedQueryParameters = preprocessQueryParameters(queryParameters, endpoint?.queryParameters);

    return buildRequestUrl({
        baseUrl: sanitizedBaseUrl || "",
        path: endpoint?.path,
        pathParameters,
        queryParameters: processedQueryParameters
    });
}
