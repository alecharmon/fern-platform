/**
 * OpenAPI 3.1.x type definitions (subset needed for conversion output).
 */

export interface OpenAPISpec {
    openapi: "3.1.0";
    info: OpenAPIInfo;
    servers?: OpenAPIServer[];
    paths: Record<string, OpenAPIPathItem>;
    components?: OpenAPIComponents;
    tags?: OpenAPITag[];
    security?: OpenAPISecurityRequirement[];
}

export interface OpenAPIInfo {
    title: string;
    version: string;
    description?: string;
}

export interface OpenAPIServer {
    url: string;
    description?: string;
    variables?: Record<string, OpenAPIServerVariable>;
}

export interface OpenAPIServerVariable {
    default: string;
    description?: string;
    enum?: string[];
}

export interface OpenAPITag {
    name: string;
    description?: string;
}

export interface OpenAPIPathItem {
    summary?: string;
    description?: string;
    get?: OpenAPIOperation;
    put?: OpenAPIOperation;
    post?: OpenAPIOperation;
    delete?: OpenAPIOperation;
    options?: OpenAPIOperation;
    head?: OpenAPIOperation;
    patch?: OpenAPIOperation;
    trace?: OpenAPIOperation;
    parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: OpenAPIParameter[];
    requestBody?: OpenAPIRequestBody;
    responses: Record<string, OpenAPIResponse>;
    security?: OpenAPISecurityRequirement[];
    deprecated?: boolean;
}

export interface OpenAPIParameter {
    name: string;
    in: "query" | "header" | "path" | "cookie";
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema?: OpenAPISchema;
    example?: unknown;
}

export interface OpenAPIRequestBody {
    description?: string;
    required?: boolean;
    content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
    description: string;
    headers?: Record<string, OpenAPIHeader>;
    content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIHeader {
    description?: string;
    schema?: OpenAPISchema;
    example?: unknown;
}

export interface OpenAPIMediaType {
    schema?: OpenAPISchema;
    example?: unknown;
    examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIExample {
    summary?: string;
    description?: string;
    value?: unknown;
}

export interface OpenAPISchema {
    type?: string | string[];
    format?: string;
    description?: string;
    properties?: Record<string, OpenAPISchema>;
    items?: OpenAPISchema;
    required?: string[];
    enum?: unknown[];
    example?: unknown;
    oneOf?: OpenAPISchema[];
    anyOf?: OpenAPISchema[];
    allOf?: OpenAPISchema[];
    additionalProperties?: boolean | OpenAPISchema;
    default?: unknown;
}

export interface OpenAPIComponents {
    schemas?: Record<string, OpenAPISchema>;
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

export interface OpenAPISecurityScheme {
    type: "apiKey" | "http" | "oauth2" | "openIdConnect";
    description?: string;
    name?: string;
    in?: "query" | "header" | "cookie";
    scheme?: string;
    bearerFormat?: string;
    flows?: OpenAPIOAuthFlows;
    openIdConnectUrl?: string;
}

export interface OpenAPIOAuthFlows {
    implicit?: OpenAPIOAuthFlow;
    password?: OpenAPIOAuthFlow;
    clientCredentials?: OpenAPIOAuthFlow;
    authorizationCode?: OpenAPIOAuthFlow;
}

export interface OpenAPIOAuthFlow {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
}

export type OpenAPISecurityRequirement = Record<string, string[]>;
