import { ApiDefinition } from "@fern-api/fdr-sdk";

/**
 * Plain JSON types for OpenAPI 3.1 spec generation.
 * We use plain types instead of `openapi-types` to avoid type incompatibilities
 * between OpenAPI 3.0 and 3.1 type definitions in the openapi-types package.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaObject = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenApiDocument = Record<string, any>;

/**
 * Generates a complete OpenAPI 3.1 specification from a Fern API definition.
 * This combines all endpoints, webhooks, types, and auth schemes into a single spec document.
 */
export function generateOpenApiSpec(
    apiDefinition: ApiDefinition.ApiDefinition,
    options?: { title?: string; version?: string }
): OpenApiDocument {
    const components: Record<string, SchemaObject> = {};
    const visitedTypes = new Set<string>();

    const context: ConversionContext = {
        types: apiDefinition.types ?? {},
        apiDefinition,
        components,
        visitedTypes
    };

    const paths: Record<string, SchemaObject> = {};
    const webhooks: Record<string, SchemaObject> = {};

    // Process all endpoints
    for (const endpoint of Object.values(apiDefinition.endpoints)) {
        const endpointPath = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);
        const method = endpoint.method.toLowerCase();

        const auth =
            apiDefinition.auths && endpoint.auth && endpoint.auth.length > 0 && endpoint.auth[0]
                ? apiDefinition.auths[endpoint.auth[0]]
                : undefined;

        const operation = buildEndpointOperation(endpoint, auth, apiDefinition.globalHeaders, context);

        if (!paths[endpointPath]) {
            paths[endpointPath] = {};
        }
        paths[endpointPath][method] = operation;
    }

    // Process all webhooks
    for (const webhook of Object.values(apiDefinition.webhooks)) {
        const webhookName = webhook.operationId ?? webhook.id;
        const method = webhook.method.toLowerCase();

        const operation = buildWebhookOperation(webhook, apiDefinition.globalHeaders, context);

        if (!webhooks[webhookName]) {
            webhooks[webhookName] = {};
        }
        webhooks[webhookName][method] = operation;
    }

    // Determine the first environment base URL as the server URL
    const servers: Array<{ url: string }> = [];
    const seenBaseUrls = new Set<string>();
    for (const endpoint of Object.values(apiDefinition.endpoints)) {
        for (const env of endpoint.environments ?? []) {
            if (env.baseUrl && !seenBaseUrls.has(env.baseUrl)) {
                seenBaseUrls.add(env.baseUrl);
                servers.push({ url: env.baseUrl });
            }
        }
    }

    const spec: OpenApiDocument = {
        openapi: "3.1.0",
        info: {
            title: options?.title ?? apiDefinition.apiName ?? "API",
            version: options?.version ?? "1.0.0"
        },
        paths
    };

    if (servers.length > 0) {
        spec.servers = servers;
    }

    if (Object.keys(webhooks).length > 0) {
        spec.webhooks = webhooks;
    }

    if (Object.keys(components).length > 0) {
        spec.components = {
            ...spec.components,
            schemas: components
        };
    }

    // Add security schemes from auth definitions
    const securitySchemes = buildSecuritySchemes(apiDefinition.auths);
    if (securitySchemes && Object.keys(securitySchemes).length > 0) {
        spec.components = {
            ...spec.components,
            securitySchemes
        };
    }

    return spec;
}

// ── Internal types ──────────────────────────────────────────────────────

export interface ConversionContext {
    types: Record<string, ApiDefinition.TypeDefinition>;
    apiDefinition: ApiDefinition.ApiDefinition;
    components: Record<string, SchemaObject>;
    visitedTypes: Set<string>;
}

// ── Security schemes ────────────────────────────────────────────────────

function buildSecuritySchemes(
    auths: Record<string, ApiDefinition.AuthScheme> | undefined | null
): Record<string, SchemaObject> | undefined {
    if (!auths) {
        return undefined;
    }

    const schemes: Record<string, SchemaObject> = {};

    for (const [id, auth] of Object.entries(auths)) {
        switch (auth.type) {
            case "basicAuth":
                schemes[id] = {
                    type: "http",
                    scheme: "basic",
                    description: auth.description ?? undefined
                };
                break;
            case "bearerAuth":
                schemes[id] = {
                    type: "http",
                    scheme: "bearer",
                    description: auth.description ?? undefined
                };
                break;
            case "header":
                schemes[id] = {
                    type: "apiKey",
                    in: "header",
                    name: auth.headerWireValue,
                    description: auth.description ?? undefined
                };
                break;
            case "oAuth":
                schemes[id] = {
                    type: "http",
                    scheme: "bearer",
                    description: "OAuth 2.0 authentication"
                };
                break;
        }
    }

    return Object.keys(schemes).length > 0 ? schemes : undefined;
}

// ── Endpoint operation builder ──────────────────────────────────────────

function buildEndpointOperation(
    endpoint: ApiDefinition.EndpointDefinition,
    auth: ApiDefinition.AuthScheme | undefined | null,
    globalHeaders: ApiDefinition.ObjectProperty[] | undefined | null,
    context: ConversionContext
): SchemaObject {
    const operation: SchemaObject = {
        operationId: endpoint.operationId ?? endpoint.id,
        summary: endpoint.displayName ?? endpoint.id,
        description: typeof endpoint.description === "string" ? endpoint.description : undefined,
        tags: endpoint.namespace ? [endpoint.namespace.join(".")] : undefined,
        parameters: [],
        responses: {}
    };

    // Path parameters
    if (endpoint.pathParameters && endpoint.pathParameters.length > 0) {
        for (const param of endpoint.pathParameters) {
            operation.parameters!.push(createParameter(param, "path", context));
        }
    }

    // Query parameters
    if (endpoint.queryParameters && endpoint.queryParameters.length > 0) {
        for (const param of endpoint.queryParameters) {
            operation.parameters!.push(createParameter(param, "query", context));
        }
    }

    // Auth header
    if (auth) {
        const authParam = createAuthParameter(auth);
        if (authParam) {
            operation.parameters!.push(authParam);
        }
    }

    // Global headers
    if (globalHeaders) {
        for (const header of globalHeaders) {
            operation.parameters!.push(createParameter(header, "header", context));
        }
    }

    // Request headers
    if (endpoint.requestHeaders) {
        for (const header of endpoint.requestHeaders) {
            operation.parameters!.push(createParameter(header, "header", context));
        }
    }

    // Remove empty parameters array
    if (operation.parameters!.length === 0) {
        delete operation.parameters;
    }

    // Request body
    if (endpoint.requests?.[0]?.body != null) {
        const request = endpoint.requests[0];
        operation.requestBody = {
            description: request.description ?? undefined,
            content: convertBodyToContent(request.body, context)
        };
    }

    // Responses
    if (endpoint.responses?.[0] != null) {
        const response = endpoint.responses[0];
        const statusCode = response.statusCode?.toString() ?? "200";
        operation.responses![statusCode] = {
            description: response.description ?? `Response with status ${statusCode}`,
            content: response.body ? convertBodyToContent(response.body, context) : undefined
        };
    } else {
        operation.responses!["200"] = {
            description: "Successful response"
        };
    }

    // Error responses
    if (endpoint.errors && endpoint.errors.length > 0) {
        for (const error of endpoint.errors) {
            const errorStatusCode = error.statusCode?.toString() ?? "400";
            const errorResponse: SchemaObject = {
                description: error.description ?? `Error response with status ${errorStatusCode}`
            };
            if (error.shape) {
                errorResponse.content = {
                    "application/json": {
                        schema: convertTypeShapeToSchema(error.shape, context)
                    }
                };
            }
            operation.responses![errorStatusCode] = errorResponse;
        }
    }

    return operation;
}

// ── Webhook operation builder ───────────────────────────────────────────

function buildWebhookOperation(
    webhook: ApiDefinition.WebhookDefinition,
    globalHeaders: ApiDefinition.ObjectProperty[] | undefined | null,
    context: ConversionContext
): SchemaObject {
    const operation: SchemaObject = {
        operationId: webhook.operationId ?? webhook.id,
        summary: webhook.displayName ?? webhook.id,
        description: typeof webhook.description === "string" ? webhook.description : undefined,
        parameters: [],
        responses: {
            "200": { description: "Webhook received successfully" }
        }
    };

    // Headers
    const headers = [...(globalHeaders ?? []), ...(webhook.headers ?? [])];
    for (const header of headers) {
        operation.parameters!.push(createParameter(header as ApiDefinition.ObjectProperty, "header", context));
    }

    if (operation.parameters!.length === 0) {
        delete operation.parameters;
    }

    // Payload
    if (webhook.payloads && webhook.payloads.length > 0) {
        if (webhook.payloads.length === 1) {
            const payload = webhook.payloads[0];
            if (payload?.shape) {
                operation.requestBody = {
                    description: typeof payload.description === "string" ? payload.description : undefined,
                    content: {
                        "application/json": {
                            schema: convertTypeShapeToSchema(payload.shape, context)
                        }
                    }
                };
            }
        } else {
            const payloadSchemas = webhook.payloads
                .filter((p) => p?.shape)
                .map((p) => convertTypeShapeToSchema(p.shape!, context));

            if (payloadSchemas.length > 0) {
                operation.requestBody = {
                    description: "Webhook payload (multiple variants)",
                    content: {
                        "application/json": {
                            schema: { oneOf: payloadSchemas } as SchemaObject
                        }
                    }
                };
            }
        }
    }

    return operation;
}

// ── Parameter builders ──────────────────────────────────────────────────

function createParameter(
    property: ApiDefinition.ObjectProperty,
    location: "query" | "header" | "path",
    context: ConversionContext
): SchemaObject {
    return {
        name: property.key,
        in: location,
        description: property.description ?? undefined,
        required: !isOptionalShape(property.valueShape),
        schema: convertTypeShapeToSchema(property.valueShape, context)
    };
}

function createAuthParameter(auth: ApiDefinition.AuthScheme): SchemaObject | null {
    const stringSchema: SchemaObject = { type: "string" };

    switch (auth.type) {
        case "basicAuth":
            return {
                name: "Authorization",
                in: "header",
                description: auth.description ?? "Basic authentication",
                required: true,
                schema: stringSchema
            };
        case "bearerAuth":
            return {
                name: "Authorization",
                in: "header",
                description: auth.description ?? "Bearer authentication",
                required: true,
                schema: stringSchema
            };
        case "header":
            return {
                name: auth.headerWireValue,
                in: "header",
                ...(auth.description && { description: auth.description }),
                required: true,
                schema: stringSchema
            };
        case "oAuth":
            return {
                name: "Authorization",
                in: "header",
                description: "OAuth authentication",
                required: true,
                schema: stringSchema
            };
        default:
            return null;
    }
}

// ── Body conversion ─────────────────────────────────────────────────────

function convertBodyToContent(
    body: ApiDefinition.HttpRequestBodyShape | ApiDefinition.HttpResponseBodyShape,
    context: ConversionContext
): Record<string, SchemaObject> {
    const content: Record<string, SchemaObject> = {};

    switch (body.type) {
        case "object":
            content["application/json"] = {
                schema: convertTypeShapeToSchema(body, context)
            };
            break;
        case "alias":
            content["application/json"] = {
                schema: convertTypeShapeToSchema(body.value, context)
            };
            break;
        case "bytes":
            content["application/octet-stream"] = {
                schema: { type: "string", format: "binary" }
            };
            break;
        case "formData": {
            const properties: Record<string, SchemaObject> = {};
            const required: string[] = [];

            for (const field of body.fields ?? []) {
                switch (field.type) {
                    case "property": {
                        const propSchema = convertTypeShapeToSchema(field.valueShape, context);
                        properties[field.key] = field.description
                            ? { ...propSchema, description: field.description }
                            : propSchema;
                        if (!isOptionalShape(field.valueShape)) {
                            required.push(field.key);
                        }
                        break;
                    }
                    case "file":
                        properties[field.key] = field.description
                            ? { type: "string", format: "binary", description: field.description }
                            : { type: "string", format: "binary" };
                        if (!field.isOptional) {
                            required.push(field.key);
                        }
                        break;
                    case "files":
                        properties[field.key] = field.description
                            ? {
                                  type: "array",
                                  items: { type: "string", format: "binary" },
                                  description: field.description
                              }
                            : {
                                  type: "array",
                                  items: { type: "string", format: "binary" }
                              };
                        if (!field.isOptional) {
                            required.push(field.key);
                        }
                        break;
                }
            }

            const formDataSchema: SchemaObject = { type: "object", properties };
            if (required.length > 0) {
                formDataSchema.required = required;
            }
            content["multipart/form-data"] = { schema: formDataSchema };
            break;
        }
        case "fileDownload":
            content["application/octet-stream"] = {
                schema: { type: "string", format: "binary" }
            };
            break;
        case "streamingText":
            content["text/plain"] = {
                schema: { type: "string" }
            };
            break;
        case "stream": {
            // FDR SDK uses `shape`, but some callers may pass `payload` instead
            const streamShape =
                (body as unknown as Record<string, unknown>).shape ??
                (body as unknown as Record<string, unknown>).payload;
            let streamSchema: SchemaObject;
            if (streamShape) {
                streamSchema = convertTypeShapeToSchema(streamShape as AnyShapeType, context);
            } else {
                streamSchema = { type: "object", description: "Stream data" } as SchemaObject;
            }
            content["text/event-stream"] = { schema: streamSchema };
            break;
        }
        case "empty":
            break;
    }

    return content;
}

// ── Type shape conversion ───────────────────────────────────────────────

function isOptionalShape(shape: ApiDefinition.TypeShapeOrReference): boolean {
    switch (shape.type) {
        case "optional":
            return true;
        case "alias":
            return isOptionalShape(shape.value);
        default:
            return false;
    }
}

function convertPrimitiveToSchema(primitive: ApiDefinition.PrimitiveType): SchemaObject {
    switch (primitive.type) {
        case "string": {
            const schema: SchemaObject = { type: "string" };
            if (primitive.format) {
                schema.format = primitive.format;
            }
            if (primitive.default !== undefined) {
                schema.default = primitive.default;
            }
            return schema;
        }
        case "integer": {
            const schema: SchemaObject = { type: "integer" };
            if (primitive.default !== undefined) {
                schema.default = primitive.default;
            }
            return schema;
        }
        case "double": {
            const schema: SchemaObject = { type: "number", format: "double" };
            if (primitive.default !== undefined) {
                schema.default = primitive.default;
            }
            return schema;
        }
        case "long": {
            const schema: SchemaObject = { type: "integer", format: "int64" };
            if (primitive.default !== undefined) {
                schema.default = primitive.default;
            }
            return schema;
        }
        case "boolean": {
            const schema: SchemaObject = { type: "boolean" };
            if (primitive.default !== undefined) {
                schema.default = primitive.default;
            }
            return schema;
        }
        case "date":
            return { type: "string", format: "date" };
        case "datetime":
            return { type: "string", format: "date-time" };
        case "uuid":
            return { type: "string", format: "uuid" };
        case "base64":
            return { type: "string", format: "base64" };
        case "bigInteger":
            return { type: "integer", format: "int64" };
        case "uint":
            return { type: "integer", format: "uint" };
        case "uint64":
            return { type: "integer", format: "uint64" };
        case "scalar": {
            const schema: SchemaObject = {
                type: "string",
                title: primitive.name,
                description: primitive.description ?? undefined
            };
            if (primitive.default !== undefined) {
                schema.default = primitive.default;
            }
            return schema;
        }
        default:
            return { type: "string" };
    }
}

function convertObjectToSchema(shape: ApiDefinition.TypeShape.Object_, context: ConversionContext): SchemaObject {
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];

    // Resolve extended types
    if (shape.extends && shape.extends.length > 0 && context.apiDefinition?.types) {
        for (const extendedTypeName of shape.extends) {
            const extendedType = context.apiDefinition.types[extendedTypeName as ApiDefinition.TypeId];
            if (extendedType?.shape) {
                const extendedSchema = convertTypeShapeToSchema(extendedType.shape, context);
                if ("properties" in extendedSchema && extendedSchema.properties) {
                    Object.assign(properties, extendedSchema.properties);
                }
                if ("required" in extendedSchema && Array.isArray(extendedSchema.required)) {
                    required.push(...extendedSchema.required);
                }
            }
        }
    }

    // Add current object's properties
    if (shape.properties) {
        for (const prop of shape.properties) {
            const propSchema = convertTypeShapeToSchema(prop.valueShape, context);
            properties[prop.key] = prop.description ? { ...propSchema, description: prop.description } : propSchema;
            if (!isOptionalShape(prop.valueShape)) {
                required.push(prop.key);
            }
        }
    }

    const result: SchemaObject = { type: "object", properties };
    if (required.length > 0) {
        result.required = [...new Set(required)];
    }
    return result;
}

function convertDiscriminatedUnionToSchema(
    shape: ApiDefinition.TypeShape.DiscriminatedUnion,
    context: ConversionContext
): SchemaObject {
    const variants = shape.variants;
    if (!variants || variants.length === 0) {
        return { type: "object" };
    }

    const oneOfSchemas = variants.map((variant: ApiDefinition.DiscriminatedUnionVariant) => {
        const variantProperties: Record<string, SchemaObject> = {
            [shape.discriminant]: {
                type: "string",
                enum: [variant.discriminantValue],
                description: `Discriminator value: ${variant.discriminantValue}`
            } as SchemaObject
        };
        const variantRequired = [shape.discriminant];

        // Resolve extended types
        if (variant.extends && variant.extends.length > 0 && context.apiDefinition?.types) {
            for (const extendedTypeName of variant.extends) {
                const extendedType =
                    context.apiDefinition.types[extendedTypeName as keyof typeof context.apiDefinition.types];
                if (extendedType?.shape) {
                    const extendedSchema = convertTypeShapeToSchema(extendedType.shape, context);
                    if ("properties" in extendedSchema && extendedSchema.properties) {
                        Object.assign(variantProperties, extendedSchema.properties);
                    }
                    if ("required" in extendedSchema && Array.isArray(extendedSchema.required)) {
                        variantRequired.push(...extendedSchema.required);
                    }
                }
            }
        }

        // Add variant's own properties
        if (variant.properties) {
            for (const prop of variant.properties) {
                const propSchema = convertTypeShapeToSchema(prop.valueShape, context);
                variantProperties[prop.key] = prop.description
                    ? { ...propSchema, description: prop.description }
                    : propSchema;
                if (!isOptionalShape(prop.valueShape)) {
                    variantRequired.push(prop.key);
                }
            }
        }

        const description = variant.description ?? (variant.displayName ? `${variant.displayName} variant` : undefined);

        return {
            type: "object" as const,
            properties: variantProperties,
            required: [...new Set(variantRequired)],
            ...(description && { description })
        };
    });

    return {
        oneOf: oneOfSchemas,
        discriminator: {
            propertyName: shape.discriminant
        } as SchemaObject
    } as SchemaObject;
}

type AnyShapeType =
    | ApiDefinition.TypeShapeOrReference
    | ApiDefinition.HttpRequestBodyShape
    | ApiDefinition.HttpResponseBodyShape;

export function convertTypeShapeToSchema(shape: AnyShapeType, context: ConversionContext): SchemaObject {
    if (!shape) {
        return {} as SchemaObject;
    }

    switch (shape.type) {
        case "primitive":
            return convertPrimitiveToSchema(shape.value);
        case "alias":
            return convertTypeShapeToSchema(shape.value, context);
        case "object":
            return convertObjectToSchema(shape, context);
        case "list":
            return {
                type: "array",
                items: convertTypeShapeToSchema(shape.itemShape, context)
            };
        case "set":
            return {
                type: "array",
                uniqueItems: true,
                items: convertTypeShapeToSchema(shape.itemShape, context)
            };
        case "map": {
            const valueSchema = convertTypeShapeToSchema(shape.valueShape, context);
            return { type: "object", additionalProperties: valueSchema };
        }
        case "optional": {
            const optionalSchema = convertTypeShapeToSchema(shape.shape, context);
            if (shape.default !== undefined) {
                return { ...optionalSchema, default: shape.default };
            }
            return optionalSchema;
        }
        case "nullable": {
            const baseSchema = convertTypeShapeToSchema(shape.shape, context);
            const schemaObj = baseSchema as SchemaObject;
            if (schemaObj.type && typeof schemaObj.type === "string") {
                return { ...schemaObj, type: [schemaObj.type, "null"] };
            }
            return {
                oneOf: [baseSchema, { type: "null" } as SchemaObject]
            } as SchemaObject;
        }
        case "enum": {
            const enumSchema: SchemaObject = {
                type: "string",
                enum: shape.values.map((v: string | { value: string }) => (typeof v === "string" ? v : v.value))
            };
            if (shape.default !== undefined) {
                enumSchema.default = shape.default;
            }
            return enumSchema;
        }
        case "literal": {
            // Support both SDK format ({ type: "stringLiteral", value: "..." }) and plain values
            const literalValue = shape.value;
            if (typeof literalValue === "object" && literalValue !== null && "type" in literalValue) {
                if (literalValue.type === "booleanLiteral") {
                    return { type: "boolean", enum: [literalValue.value] } as SchemaObject;
                }
                return { type: "string", enum: [literalValue.value] } as SchemaObject;
            }
            // Plain value (string, boolean, number)
            if (typeof literalValue === "boolean") {
                return { type: "boolean", enum: [literalValue] } as SchemaObject;
            }
            return { type: "string", enum: [literalValue] } as SchemaObject;
        }
        case "undiscriminatedUnion": {
            const variants = shape.variants ?? [];
            if (variants.length > 0) {
                return {
                    oneOf: variants.map((variant: ApiDefinition.UndiscriminatedUnionVariant | AnyShapeType) =>
                        convertTypeShapeToSchema("shape" in variant ? variant.shape : variant, context)
                    )
                } as SchemaObject;
            }
            return {} as SchemaObject;
        }
        case "discriminatedUnion":
            return convertDiscriminatedUnionToSchema(shape, context);
        case "id": {
            const buildRef = (ref: string): SchemaObject => {
                if (shape.default !== undefined) {
                    return { $ref: ref, default: shape.default };
                }
                return { $ref: ref };
            };

            if (context.apiDefinition?.types?.[shape.id]) {
                const typeDef = context.apiDefinition.types[shape.id];
                if (!typeDef) {
                    return { description: `Reference to ${shape.id}` } as SchemaObject;
                }

                if (context.visitedTypes.has(shape.id)) {
                    return buildRef(`#/components/schemas/${shape.id}`);
                }

                context.visitedTypes.add(shape.id);

                if (!context.components[shape.id]) {
                    const resolvedSchema = convertTypeShapeToSchema(typeDef.shape, context);
                    const schemaObj = resolvedSchema as SchemaObject;
                    if (typeDef.description && !schemaObj.description) {
                        schemaObj.description = typeDef.description;
                    }
                    if (typeDef.name) {
                        schemaObj.title = typeDef.name;
                    }
                    context.components[shape.id] = resolvedSchema;
                }

                context.visitedTypes.delete(shape.id);

                return buildRef(`#/components/schemas/${shape.id}`);
            }
            return { description: `Reference to ${shape.id}` } as SchemaObject;
        }
        case "unknown":
            return { description: shape.displayName ?? "Any type" } as SchemaObject;
        case "bytes":
            return { type: "string", format: "binary" };
        case "formData":
            return { type: "object" };
        case "empty":
            return {};
        case "fileDownload":
            return { type: "string", format: "binary" };
        case "streamingText":
            return { type: "string" };
        case "stream":
            return { type: "object" };
        default:
            return {} as SchemaObject;
    }
}
