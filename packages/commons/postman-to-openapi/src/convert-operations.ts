import type {
    OpenAPIExample,
    OpenAPIHeader,
    OpenAPIMediaType,
    OpenAPIOperation,
    OpenAPIParameter,
    OpenAPIPathItem,
    OpenAPIRequestBody,
    OpenAPIResponse,
    OpenAPISchema
} from "./openapi-types.js";
import type {
    PostmanBody,
    PostmanHeader,
    PostmanItem,
    PostmanItemOrGroup,
    PostmanQueryParam,
    PostmanRequest,
    PostmanResponse,
    PostmanVariable
} from "./postman-types.js";
import { isItemGroup } from "./postman-types.js";
import { inferSchemaFromJsonString } from "./schema-inference.js";
import { extractDescription, extractRawUrl, generateOperationId, parseUrl, sanitizeTagName } from "./utils.js";

interface ConvertedPaths {
    paths: Record<string, OpenAPIPathItem>;
    tags: Array<{ name: string; description?: string }>;
}

/**
 * Converts all Postman items/groups into OpenAPI paths and tags.
 * Folder structure is preserved as tags.
 */
export function convertOperations(
    items: PostmanItemOrGroup[],
    collectionVariables?: PostmanVariable[]
): ConvertedPaths {
    const paths: Record<string, OpenAPIPathItem> = {};
    const tags: Array<{ name: string; description?: string }> = [];
    const usedOperationIds = new Set<string>();

    processItems(items, [], paths, tags, usedOperationIds, collectionVariables);

    return { paths, tags };
}

function processItems(
    items: PostmanItemOrGroup[],
    parentTags: string[],
    paths: Record<string, OpenAPIPathItem>,
    tags: Array<{ name: string; description?: string }>,
    usedOperationIds: Set<string>,
    collectionVariables?: PostmanVariable[]
): void {
    for (const item of items) {
        if (isItemGroup(item)) {
            const tagName = sanitizeTagName(item.name ?? "default");
            const existingTag = tags.find((t) => t.name === tagName);
            if (!existingTag) {
                tags.push({
                    name: tagName,
                    description: extractDescription(item.description)
                });
            }

            const groupVariables = mergeVariables(collectionVariables, item.variable);
            processItems(item.item, [...parentTags, tagName], paths, tags, usedOperationIds, groupVariables);
        } else {
            convertItem(item, parentTags, paths, usedOperationIds, collectionVariables);
        }
    }
}

function convertItem(
    item: PostmanItem,
    tags: string[],
    paths: Record<string, OpenAPIPathItem>,
    usedOperationIds: Set<string>,
    collectionVariables?: PostmanVariable[]
): void {
    const request = item.request;
    if (typeof request === "string") {
        return;
    }

    const method = (request.method ?? "GET").toLowerCase();
    const rawUrl = extractRawUrl(request.url);
    if (!rawUrl) {
        return;
    }

    const allVariables = mergeVariables(collectionVariables, item.variable);
    const { path } = parseUrl(rawUrl, allVariables);

    // Ensure path starts with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    let operationId = generateOperationId(method, normalizedPath);
    if (usedOperationIds.has(operationId)) {
        let counter = 2;
        while (usedOperationIds.has(`${operationId}${counter}`)) {
            counter++;
        }
        operationId = `${operationId}${counter}`;
    }
    usedOperationIds.add(operationId);

    const operation: OpenAPIOperation = {
        operationId,
        summary: item.name ?? undefined,
        description: extractDescription(item.description) ?? extractDescription(request.description),
        responses: {}
    };

    if (tags.length > 0) {
        operation.tags = [...tags];
        operation["x-fern-sdk-group-name"] = [...tags];
    }

    if (item.name != null) {
        operation["x-fern-sdk-method-name"] = item.name;
    }

    // Convert parameters
    const parameters = convertParameters(request, allVariables);
    if (parameters.length > 0) {
        operation.parameters = parameters;
    }

    // Convert request body
    const requestBody = convertRequestBody(request);
    if (requestBody) {
        operation.requestBody = requestBody;
    }

    // Convert responses from examples
    operation.responses = convertResponses(item.response);

    // Ensure at least a default response
    if (Object.keys(operation.responses).length === 0) {
        operation.responses["200"] = { description: "Successful response" };
    }

    // Add to paths
    if (!paths[normalizedPath]) {
        paths[normalizedPath] = {};
    }
    const pathItem = paths[normalizedPath]!;

    // Set the operation on the correct HTTP method
    switch (method) {
        case "get":
            pathItem.get = operation;
            break;
        case "post":
            pathItem.post = operation;
            break;
        case "put":
            pathItem.put = operation;
            break;
        case "delete":
            pathItem.delete = operation;
            break;
        case "patch":
            pathItem.patch = operation;
            break;
        case "options":
            pathItem.options = operation;
            break;
        case "head":
            pathItem.head = operation;
            break;
        case "trace":
            pathItem.trace = operation;
            break;
        default:
            pathItem.post = operation;
            break;
    }
}

function convertParameters(request: PostmanRequest, variables?: PostmanVariable[]): OpenAPIParameter[] {
    const params: OpenAPIParameter[] = [];

    // Path parameters from URL
    const url = request.url;
    if (url != null && typeof url !== "string") {
        // From URL variable definitions
        if (url.variable) {
            for (const v of url.variable) {
                if (v.key) {
                    params.push({
                        name: v.key,
                        in: "path",
                        required: true,
                        description: extractDescription(v.description),
                        schema: { type: "string" },
                        example: v.value != null ? String(v.value) : undefined
                    });
                }
            }
        }

        // From path segments containing :param or {param} patterns
        if (url.path) {
            for (const segment of url.path) {
                const segStr = typeof segment === "string" ? segment : (segment.value ?? "");
                const colonMatch = segStr.match(/^:(.+)$/);
                if (colonMatch?.[1]) {
                    const paramName = colonMatch[1];
                    if (!params.some((p) => p.name === paramName)) {
                        params.push({
                            name: paramName,
                            in: "path",
                            required: true,
                            schema: { type: "string" }
                        });
                    }
                }
            }
        }

        // Query parameters
        if (url.query) {
            for (const q of url.query) {
                if (q.key && !q.disabled) {
                    params.push({
                        name: q.key,
                        in: "query",
                        description: extractDescription(q.description),
                        schema: inferQueryParamSchema(q),
                        example: q.value ?? undefined
                    });
                }
            }
        }
    }

    // Header parameters (exclude standard headers)
    if (Array.isArray(request.header)) {
        for (const h of request.header) {
            if (!h.disabled && !isStandardHeader(h.key)) {
                params.push({
                    name: h.key,
                    in: "header",
                    description: extractDescription(h.description),
                    schema: { type: "string" },
                    example: h.value || undefined
                });
            }
        }
    }

    return params;
}

function inferQueryParamSchema(param: PostmanQueryParam): OpenAPISchema {
    const value = param.value;
    if (value == null) {
        return { type: "string" };
    }
    if (value === "true" || value === "false") {
        return { type: "boolean" };
    }
    if (/^\d+$/.test(value)) {
        return { type: "integer" };
    }
    if (/^\d+\.\d+$/.test(value)) {
        return { type: "number" };
    }
    return { type: "string" };
}

const STANDARD_HEADERS = new Set([
    "content-type",
    "accept",
    "authorization",
    "user-agent",
    "host",
    "connection",
    "cache-control",
    "accept-encoding",
    "accept-language",
    "content-length",
    "cookie",
    "origin",
    "referer"
]);

function isStandardHeader(key: string): boolean {
    return STANDARD_HEADERS.has(key.toLowerCase());
}

function convertRequestBody(request: PostmanRequest): OpenAPIRequestBody | undefined {
    const body = request.body;
    if (!body || body.disabled) {
        return undefined;
    }

    const content: Record<string, OpenAPIMediaType> = {};

    switch (body.mode) {
        case "raw": {
            const mediaType = detectRawContentType(body);
            const mediaTypeObj: OpenAPIMediaType = {};

            if (body.raw) {
                const inferred = inferSchemaFromJsonString(body.raw);
                if (inferred) {
                    mediaTypeObj.schema = inferred.schema;
                    mediaTypeObj.example = inferred.example;
                } else {
                    mediaTypeObj.schema = { type: "string" };
                    mediaTypeObj.example = body.raw;
                }
            }

            content[mediaType] = mediaTypeObj;
            break;
        }
        case "urlencoded": {
            if (body.urlencoded) {
                const properties: Record<string, OpenAPISchema> = {};
                const requiredFields: string[] = [];

                for (const param of body.urlencoded) {
                    if (!param.disabled) {
                        properties[param.key] = { type: "string" };
                        if (param.description) {
                            properties[param.key]!.description = extractDescription(param.description);
                        }
                        requiredFields.push(param.key);
                    }
                }

                content["application/x-www-form-urlencoded"] = {
                    schema: {
                        type: "object",
                        properties,
                        ...(requiredFields.length > 0 ? { required: requiredFields } : {})
                    }
                };
            }
            break;
        }
        case "formdata": {
            if (body.formdata) {
                const properties: Record<string, OpenAPISchema> = {};
                const requiredFields: string[] = [];

                for (const param of body.formdata) {
                    if (!param.disabled) {
                        if (param.type === "file") {
                            properties[param.key] = { type: "string", format: "binary" };
                        } else {
                            properties[param.key] = { type: "string" };
                        }
                        if (param.description) {
                            properties[param.key]!.description = extractDescription(param.description);
                        }
                        requiredFields.push(param.key);
                    }
                }

                content["multipart/form-data"] = {
                    schema: {
                        type: "object",
                        properties,
                        ...(requiredFields.length > 0 ? { required: requiredFields } : {})
                    }
                };
            }
            break;
        }
        case "file": {
            content["application/octet-stream"] = {
                schema: { type: "string", format: "binary" }
            };
            break;
        }
        case "graphql": {
            const properties: Record<string, OpenAPISchema> = {
                query: { type: "string" }
            };
            if (body.graphql?.variables) {
                properties.variables = { type: "object" };
            }
            content["application/json"] = {
                schema: { type: "object", properties, required: ["query"] }
            };
            break;
        }
        default:
            return undefined;
    }

    if (Object.keys(content).length === 0) {
        return undefined;
    }

    return { content };
}

function detectRawContentType(body: PostmanBody): string {
    const language = body.options?.raw?.language;
    switch (language) {
        case "json":
            return "application/json";
        case "xml":
            return "application/xml";
        case "html":
            return "text/html";
        case "text":
            return "text/plain";
        case "javascript":
            return "application/javascript";
        default:
            // Try to detect from content
            if (body.raw) {
                const trimmed = body.raw.trim();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    return "application/json";
                }
                if (trimmed.startsWith("<")) {
                    return "application/xml";
                }
            }
            return "application/json";
    }
}

function convertResponses(responses: PostmanResponse[] | undefined): Record<string, OpenAPIResponse> {
    if (!responses || responses.length === 0) {
        return {};
    }

    const result: Record<string, OpenAPIResponse> = {};
    const examplesByStatus: Record<string, Array<{ name: string; response: PostmanResponse }>> = {};

    // Group responses by status code
    for (const resp of responses) {
        const statusCode = String(resp.code ?? 200);
        if (!examplesByStatus[statusCode]) {
            examplesByStatus[statusCode] = [];
        }
        examplesByStatus[statusCode]!.push({
            name: resp.name ?? `Example ${examplesByStatus[statusCode]!.length + 1}`,
            response: resp
        });
    }

    for (const [statusCode, examples] of Object.entries(examplesByStatus)) {
        const firstExample = examples[0];
        if (!firstExample) {
            continue;
        }
        const firstResponse = firstExample.response;
        const openApiResponse: OpenAPIResponse = {
            description: firstResponse.status ?? getDefaultStatusDescription(statusCode)
        };

        // Convert response headers
        const headers = convertResponseHeaders(firstResponse.header);
        if (headers && Object.keys(headers).length > 0) {
            openApiResponse.headers = headers;
        }

        // Convert response body (skip empty/whitespace-only bodies)
        if (firstResponse.body != null && firstResponse.body.trim().length > 0) {
            const contentType = detectResponseContentType(firstResponse);

            if (examples.length === 1) {
                // Single example: use inline example
                const mediaType: OpenAPIMediaType = {};
                const inferred = inferSchemaFromJsonString(firstResponse.body);
                if (inferred) {
                    mediaType.schema = inferred.schema;
                    mediaType.example = inferred.example;
                } else if (contentType === "application/json") {
                    // Body is not valid JSON but content type says JSON — treat as plain text
                    openApiResponse.content = {
                        "text/plain": { schema: { type: "string" }, example: firstResponse.body }
                    };
                    result[statusCode] = openApiResponse;
                    continue;
                } else {
                    mediaType.schema = { type: "string" };
                    mediaType.example = firstResponse.body;
                }
                openApiResponse.content = { [contentType]: mediaType };
            } else {
                // Multiple examples for same status code: use `examples` map
                const mediaType: OpenAPIMediaType = {};
                const openApiExamples: Record<string, OpenAPIExample> = {};

                // Use schema from first example
                const inferred = inferSchemaFromJsonString(firstResponse.body);
                if (inferred) {
                    mediaType.schema = inferred.schema;
                }

                for (const ex of examples) {
                    const parsedBody = inferSchemaFromJsonString(ex.response.body ?? "");
                    openApiExamples[sanitizeExampleName(ex.name)] = {
                        summary: ex.name,
                        value: parsedBody?.example ?? ex.response.body
                    };
                }

                mediaType.examples = openApiExamples;
                openApiResponse.content = { [contentType]: mediaType };
            }
        }

        result[statusCode] = openApiResponse;
    }

    return result;
}

function convertResponseHeaders(
    headers: PostmanHeader[] | string | null | undefined
): Record<string, OpenAPIHeader> | undefined {
    if (!headers || typeof headers === "string") {
        return undefined;
    }

    const result: Record<string, OpenAPIHeader> = {};
    for (const header of headers) {
        if (!isStandardResponseHeader(header.key)) {
            result[header.key] = {
                description: extractDescription(header.description),
                schema: { type: "string" },
                example: header.value || undefined
            };
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

const STANDARD_RESPONSE_HEADERS = new Set([
    "content-type",
    "content-length",
    "content-encoding",
    "transfer-encoding",
    "connection",
    "date",
    "server",
    "vary",
    "set-cookie"
]);

function isStandardResponseHeader(key: string): boolean {
    return STANDARD_RESPONSE_HEADERS.has(key.toLowerCase());
}

function detectResponseContentType(response: PostmanResponse): string {
    // Check response headers for content type
    if (Array.isArray(response.header)) {
        const ctHeader = response.header.find((h) => h.key.toLowerCase() === "content-type");
        if (ctHeader?.value) {
            // Extract just the media type without parameters
            return ctHeader.value.split(";")[0]!.trim();
        }
    }

    // Detect from body content
    if (response.body) {
        const trimmed = response.body.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return "application/json";
        }
        if (trimmed.startsWith("<")) {
            return "application/xml";
        }
    }

    // Check preview language hint
    if (response._postman_previewlanguage) {
        switch (response._postman_previewlanguage) {
            case "json":
                return "application/json";
            case "xml":
                return "application/xml";
            case "html":
                return "text/html";
            default:
                break;
        }
    }

    return "application/json";
}

function sanitizeExampleName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}

function getDefaultStatusDescription(statusCode: string): string {
    const descriptions: Record<string, string> = {
        "200": "OK",
        "201": "Created",
        "204": "No Content",
        "400": "Bad Request",
        "401": "Unauthorized",
        "403": "Forbidden",
        "404": "Not Found",
        "500": "Internal Server Error"
    };
    return descriptions[statusCode] ?? "Response";
}

function mergeVariables(parent?: PostmanVariable[], child?: PostmanVariable[]): PostmanVariable[] | undefined {
    if (!parent && !child) {
        return undefined;
    }
    if (!parent) {
        return child;
    }
    if (!child) {
        return parent;
    }
    // Child variables override parent
    const merged = [...parent];
    for (const cv of child) {
        const existingIndex = merged.findIndex((v) => v.key === cv.key);
        if (existingIndex >= 0) {
            merged[existingIndex] = cv;
        } else {
            merged.push(cv);
        }
    }
    return merged;
}
