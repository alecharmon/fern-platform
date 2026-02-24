import { sanitizeUrl, unknownToString } from "@fern-api/ui-core-utils";
import visitDiscriminatedUnion from "@fern-api/ui-core-utils/visitDiscriminatedUnion";
import { compact } from "es-toolkit/array";
import { noop } from "ts-essentials";
import urljoin from "url-join";

import type * as Latest from "../latest";
import { preprocessQueryParameters } from "../url";

function buildPathForSnippet(
    path: Latest.PathPart[] | undefined,
    pathParameters: Record<string, unknown> | undefined
): string {
    if (path == null) {
        return "";
    }
    return path
        .map((part) => {
            if (part.type === "pathParameter") {
                const key = part.value;
                const value = unknownToString(pathParameters?.[key]);
                return value.length > 0 ? value : `{${key}}`;
            }
            return part.value;
        })
        .join("");
}

interface SnippetHttpRequestBodyJson {
    type: "json";
    value?: unknown;
}

interface SnippetHttpRequestBodyJsonExploded {
    type: "exploded";
    value?: unknown[];
}

export interface SnippetHttpRequestBodyForm {
    type: "form";
    value: Record<string, SnippetHttpRequestBodyFormValue>;
}

export interface SnippetHttpRequestBodyFormValueFilename {
    type: "filename";
    filename: string;
    contentType: string | undefined;
}

export interface SnippetHttpRequestBodyFormValueFilenames {
    type: "filenames";
    files: Omit<SnippetHttpRequestBodyFormValueFilename, "type">[];
}

export type SnippetHttpRequestBodyFormValue =
    | SnippetHttpRequestBodyJson
    | SnippetHttpRequestBodyJsonExploded
    | SnippetHttpRequestBodyFormValueFilename
    | SnippetHttpRequestBodyFormValueFilenames;

interface SnippetHttpRequestBodyBytes {
    type: "bytes";
    filename: string;
}

export type SnippetHttpRequestBody =
    | SnippetHttpRequestBodyJson
    | SnippetHttpRequestBodyForm
    | SnippetHttpRequestBodyBytes;

export interface SnippetHttpRequest {
    method: string;
    url: string;
    searchParams: Record<string, unknown>;
    headers: Record<string, unknown>;
    basicAuth?: {
        username: string;
        password: string;
    };
    body: SnippetHttpRequestBody | undefined;
    protocol?: Latest.Protocol;
    redacted?: boolean;
}

// TODO: validate that global headers are also included in the example by CLI or FDR
export function toSnippetHttpRequest(
    endpoint: Latest.EndpointDefinition,
    example: Latest.ExampleEndpointCall,
    auth: Latest.AuthScheme | undefined
): SnippetHttpRequest {
    const environmentUrl = (
        endpoint.environments?.find((env) => env.id === endpoint.defaultEnvironment) ?? endpoint.environments?.[0]
    )?.baseUrl;
    const sanitizedEnvironment = sanitizeUrl(environmentUrl);

    const endpointPathRaw = buildPathForSnippet(endpoint.path, example.pathParameters ?? undefined);
    const examplePathRaw = example.path ? (example.path.startsWith("/") ? example.path : `/${example.path}`) : "";

    // Normalize for comparison only (strip trailing slash, treat empty as "/")
    const normalize = (p: string): string => (p.endsWith("/") ? p.slice(0, -1) : p) || "/";
    const endpointPath = normalize(endpointPathRaw);
    const examplePath = normalize(examplePathRaw);

    // Use endpoint.path if it equals or extends example.path (has base path prefix)
    const useEndpointPath =
        endpointPath === examplePath ||
        (endpointPath.length > examplePath.length && endpointPath.endsWith(examplePath));
    const fullPath = useEndpointPath ? endpointPathRaw : examplePathRaw;

    const url = urljoin(compact([sanitizedEnvironment, fullPath]));

    const headers: Record<string, unknown> = { ...example.headers };

    let basicAuth: { username: string; password: string } | undefined;

    if (endpoint.auth && endpoint.auth.length > 0 && auth) {
        visitDiscriminatedUnion(auth, "type")._visit({
            basicAuth: ({ usernameName = "username", passwordName = "password" }) => {
                basicAuth = {
                    username: `<${usernameName}>`,
                    password: `<${passwordName}>`
                };
            },
            bearerAuth: ({ tokenName = "token" }) => {
                headers.Authorization = `Bearer <${tokenName}>`;
            },
            header: ({ headerWireValue, nameOverride = headerWireValue, prefix }) => {
                headers[headerWireValue] = prefix != null ? `${prefix} <${nameOverride}>` : `<${nameOverride}>`;
            },
            oAuth: ({ value: clientCredentials }) => {
                visitDiscriminatedUnion(clientCredentials, "type")._visit({
                    clientCredentials: () => {
                        headers.Authorization = "Bearer <token>";
                    },
                    _other: noop
                });
            },
            _other: noop
        });
    }

    const body: Latest.ExampleEndpointRequest | undefined = example.requestBody ?? undefined;

    if (endpoint.requests?.[0]?.contentType != null) {
        headers["Content-Type"] = endpoint.requests?.[0]?.contentType;
    }

    if (body != null && headers["Content-Type"] == null) {
        if (body.type === "json") {
            headers["Content-Type"] = "application/json";
        } else if (body.type === "form") {
            headers["Content-Type"] = "multipart/form-data";
        }
    }

    // If endpoint is OpenRPC, ensure Content-Type is application/json
    if (endpoint.protocol?.type === "openrpc") {
        headers["Content-Type"] = "application/json";
    }

    // Preprocess query parameters based on explode metadata
    const processedQueryParams =
        preprocessQueryParameters(example.queryParameters ?? undefined, endpoint.queryParameters ?? undefined) ?? {};

    return {
        method: endpoint.method,
        url,
        searchParams: processedQueryParams,
        headers: JSON.parse(JSON.stringify(headers)),
        basicAuth,
        protocol: endpoint.protocol ?? undefined,
        body:
            body == null
                ? undefined
                : visitDiscriminatedUnion(body)._visit<SnippetHttpRequestBody | undefined>({
                      json: (value) => value,
                      form: (value) => {
                          const toRet: Record<string, SnippetHttpRequestBodyFormValue> = {};
                          for (const [key, val] of Object.entries(value.value)) {
                              const typedVal = val as {
                                  type: string;
                                  value?: unknown;
                                  filename?: string;
                                  files?: { filename: string }[];
                              };
                              const formValue = visitDiscriminatedUnion(typedVal, "type")._visit<
                                  SnippetHttpRequestBodyFormValue | undefined
                              >({
                                  exploded: (value) => ({ type: "exploded", value: value.value as unknown[] }),
                                  json: (value) => ({ type: "json", value: value.value }),
                                  filename: (value) => ({
                                      type: "filename",
                                      filename: String(value.value ?? ""),
                                      contentType: undefined // TODO: infer content type?
                                  }),
                                  filenames: (value) => ({
                                      type: "filenames",
                                      files: (value.value as string[]).map((filename: string) => ({
                                          filename,
                                          contentType: undefined // TODO: infer content type?
                                      }))
                                  }),
                                  filenameWithData: (value) => ({
                                      type: "filename",
                                      filename: String(value.filename ?? ""),
                                      contentType: undefined // TODO: infer content type?
                                  }),
                                  filenamesWithData: (value) => ({
                                      type: "filenames",
                                      files: ((value.value as { filename: string }[]) ?? []).map(
                                          ({ filename }: { filename: string }) => ({
                                              filename,
                                              contentType: undefined // TODO: infer content type?
                                          })
                                      )
                                  }),
                                  _other: () => undefined
                              });
                              if (formValue != null) {
                                  toRet[key] = formValue;
                              }
                          }
                          return { type: "form", value: toRet };
                      },
                      // TODO: filename should be provided in the example from the API definition
                      bytes: () => ({ type: "bytes", filename: "<filename>" }),
                      _other: () => undefined
                  })
    };
}
