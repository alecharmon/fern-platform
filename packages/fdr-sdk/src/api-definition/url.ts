import { sanitizeUrl, unknownToString } from "@fern-api/ui-core-utils";
import qs from "qs";

import type { EndpointDefinition, PathPart } from "./latest";

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

    return buildRequestUrl({
        baseUrl: sanitizedBaseUrl || "",
        path: endpoint?.path,
        pathParameters,
        queryParameters
    });
}
