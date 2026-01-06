import { unknownToString, visitDiscriminatedUnion } from "@fern-api/ui-core-utils";
import type { HarRequest } from "httpsnippet-lite";
import type { ApiAuth } from "../../client/APIV1Read";
import {
    type AuthSchemeId,
    buildEndpointUrl,
    type EndpointDefinition,
    type ExampleEndpointCall,
    type ExampleEndpointRequest,
    preprocessQueryParameters
} from "../";

export function getHarRequest(
    endpoint: EndpointDefinition,
    example: ExampleEndpointCall,
    auths: Record<AuthSchemeId, ApiAuth>,
    requestBody: ExampleEndpointRequest | undefined
): HarRequest {
    const request: HarRequest = {
        httpVersion: "1.1",
        method: "GET",
        url: "",
        headers: [],
        headersSize: -1,
        queryString: [],
        cookies: [],
        bodySize: -1
    };
    const builtUrl = buildEndpointUrl({
        endpoint,
        // omit query parameters here because they are included in the `queryString` field
        pathParameters: example.pathParameters
    });

    // HTTPSnippet requires a full URL with protocol and host
    // If the built URL is a relative path, prepend a placeholder base URL
    request.url =
        builtUrl.startsWith("http://") || builtUrl.startsWith("https://")
            ? builtUrl
            : `https://api.example.com${builtUrl.startsWith("/") ? "" : "/"}${builtUrl}`;

    request.method = endpoint.method;

    // Preprocess query parameters based on explode metadata
    const processedQueryParams = preprocessQueryParameters(example.queryParameters, endpoint.queryParameters) ?? {};
    request.queryString = Object.entries(processedQueryParams).map(([name, value]) => ({
        name,
        value: unknownToString(value)
    }));
    request.headers = Object.entries(example.headers ?? {}).map(([name, value]) => ({
        name,
        value: unknownToString(value)
    }));

    let mimeType = endpoint.requests?.[0]?.contentType;

    if (requestBody != null) {
        if (mimeType == null) {
            mimeType = requestBody.type === "json" ? "application/json" : "multipart/form-data";
        }
        request.postData = {
            mimeType
        };

        // filter out request parameters that have no value and are not an array
        if (requestBody.value && typeof requestBody.value === "object" && !Array.isArray(requestBody.value)) {
            requestBody.value = Object.fromEntries(
                Object.entries(requestBody.value).filter(([_, valueObj]) => {
                    // Keep arrays and primitive values
                    if (Array.isArray(valueObj) || typeof valueObj !== "object" || valueObj == null) {
                        return true;
                    }
                    // For objects, only filter out empty objects without a value property
                    return Object.keys(valueObj).length > 0;
                })
            );
        }

        if (requestBody.type === "json") {
            request.postData.text = JSON.stringify(requestBody.value, null, 2);
        } else if (requestBody.type === "form") {
            request.postData.params = [];

            for (const [name, value] of Object.entries(requestBody.value)) {
                if (value.type === "json") {
                    request.postData.params.push({
                        name,
                        value: typeof value.value === "string" ? value.value : JSON.stringify(value.value, null, 2)
                    });
                } else if (value.type === "filename") {
                    request.postData.params.push({
                        name,
                        fileName: value.value
                    });
                } else if (value.type === "filenameWithData") {
                    request.postData.params.push({
                        name,
                        fileName: value.filename
                    });
                } else if (value.type === "filenames") {
                    for (const fileName of value.value) {
                        request.postData.params.push({
                            name,
                            fileName
                        });
                    }
                } else if (value.type === "filenamesWithData") {
                    for (const { filename } of value.value) {
                        request.postData.params.push({
                            name,
                            fileName: filename
                        });
                    }
                }
            }
        } else if (requestBody.type === "bytes") {
            // TODO: verify this is correct
            request.postData.params = [{ name: "file", value: requestBody.value.value }];
        }
    }

    const auth = endpoint.auth?.[0] != null ? auths[endpoint.auth[0]] : undefined;

    if (auth != null) {
        visitDiscriminatedUnion(auth)._visit({
            basicAuth: ({ usernameName = "username", passwordName = "password" }) => {
                request.headers.push({
                    name: "Authorization",
                    value: `Basic <${usernameName}>:<${passwordName}>`
                });
            },
            bearerAuth: ({ tokenName = "token" }) => {
                request.headers.push({
                    name: "Authorization",
                    value: `Bearer <${tokenName}>`
                });
            },
            header: ({ headerWireValue, nameOverride = headerWireValue, prefix }) => {
                request.headers.push({
                    name: headerWireValue,
                    value: prefix != null ? `${prefix} <${nameOverride}>` : `<${nameOverride}>`
                });
            },
            oAuth: (oAuth) => {
                visitDiscriminatedUnion(oAuth.value, "type")._visit({
                    clientCredentials: (clientCredentials) => {
                        visitDiscriminatedUnion(clientCredentials.value, "type")._visit({
                            referencedEndpoint: () => {
                                request.headers.push({
                                    name: clientCredentials.value.headerName || "Authorization",
                                    value: `${clientCredentials.value.tokenPrefix ? `${clientCredentials.value.tokenPrefix ?? "Bearer"} ` : ""}<token>.`
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    if (mimeType != null) {
        request.headers.push({
            name: "Content-Type",
            value: mimeType
        });
    }

    return request;
}
