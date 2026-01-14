/** Location in an OpenAPI spec file where a description can be found/edited. */
export interface OpenApiLocation {
    filePath: string;
    jsonPath: string[];
    isInOverride: boolean;
    /**
     * Path for writing descriptions inline in operations.
     * Only set when the schema is defined inline (not via $ref).
     * For $ref schemas, this is undefined to ensure overrides write to the component schema
     * (OpenAPI merge tools don't deep-merge across $ref boundaries).
     */
    inlineJsonPath?: string[];
}

/** Result of attempting to resolve a description target to an OpenAPI location. */
export interface OpenApiResolverResult {
    location: OpenApiLocation | null;
    reason?: OpenApiResolverFailureReason;
}

export type OpenApiResolverFailureReason =
    | "not-found" // Element doesn't exist in any spec
    | "non-openapi-format" // API is defined in AsyncAPI, OpenRPC, Proto/gRPC, or Fern Definition
    | "unsupported-ref" // Circular ref or complex ref pattern
    | "composition-type" // allOf/oneOf/anyOf (complex merge semantics)
    | "unsupported-protocol" // WebSocket channels, Webhooks (not standard OpenAPI operations)
    | "editing-not-available"; // No target provided or editing context unavailable

/** Result of resolving where to write a description edit, with override handling. */
export interface OpenApiWriteResult extends OpenApiResolverResult {
    /** Override file exists but doesn't have this specific path yet */
    needsStructureCreation?: boolean;
    /** No override file exists; one should be created */
    needsOverrideFile?: boolean;
    /** Suggested path for new override file (only set when needsOverrideFile is true) */
    suggestedOverridePath?: string;
}

/** Identifies what description we're trying to find/edit. */
export type DescriptionTarget =
    | EndpointDescriptionTarget
    | WebSocketDescriptionTarget
    | WebhookDescriptionTarget
    | GrpcDescriptionTarget
    | SchemaDescriptionTarget
    | PropertyDescriptionTarget
    | ParameterDescriptionTarget
    | RequestBodyDescriptionTarget
    | RequestBodyPropertyDescriptionTarget
    | ResponseDescriptionTarget
    | ResponsePropertyDescriptionTarget
    | EnumValueDescriptionTarget
    | FormDataFieldDescriptionTarget;

export interface EndpointDescriptionTarget {
    type: "endpoint";
    operationId?: string;
    method: string;
    path: string;
}

/**
 * Target for WebSocket channel descriptions.
 * Note: WebSocket editing is not yet supported; returns "unsupported-protocol" reason.
 */
export interface WebSocketDescriptionTarget {
    type: "websocket";
    path: string;
}

/**
 * Target for Webhook descriptions.
 * Note: Webhook editing is not yet supported; returns "unsupported-protocol" reason.
 */
export interface WebhookDescriptionTarget {
    type: "webhook";
    webhookId: string;
}

/**
 * Target for gRPC method descriptions.
 * Note: gRPC editing is not yet supported (proto format); returns "non-openapi-format" reason.
 */
export interface GrpcDescriptionTarget {
    type: "grpc";
    methodId: string;
}

export interface SchemaDescriptionTarget {
    type: "schema";
    typeId: string;
}

export interface PropertyDescriptionTarget {
    type: "property";
    typeId: string;
    /** Path from root (e.g., ["address", "street"] for nested property) */
    propertyPath: string[];
}

export interface ParameterDescriptionTarget {
    type: "parameter";
    operationId?: string;
    method: string;
    path: string;
    paramName: string;
    paramIn: "path" | "query" | "header" | "cookie";
}

export interface RequestBodyDescriptionTarget {
    type: "requestBody";
    operationId?: string;
    method: string;
    path: string;
}

export interface RequestBodyPropertyDescriptionTarget {
    type: "requestBodyProperty";
    operationId?: string;
    method: string;
    path: string;
    /** Path from request body root (e.g., ["address", "street"] for nested property) */
    propertyPath: string[];
}

export interface ResponseDescriptionTarget {
    type: "response";
    operationId?: string;
    method: string;
    path: string;
    statusCode: number;
}

export interface ResponsePropertyDescriptionTarget {
    type: "responseProperty";
    operationId?: string;
    method: string;
    path: string;
    statusCode: number;
    /** Path from response body root (e.g., ["data", "items"] for nested property) */
    propertyPath: string[];
}

export interface EnumValueDescriptionTarget {
    type: "enumValue";
    typeId: string;
    enumValue: string;
}

export interface FormDataFieldDescriptionTarget {
    type: "formDataField";
    operationId?: string;
    method: string;
    path: string;
    fieldKey: string;
    fieldType: "file" | "files" | "property";
}

/** Parsed OpenAPI spec structure (subset of fields we need). */
export interface ParsedOpenApiSpec {
    paths?: Record<string, PathItemObject>;
    components?: {
        schemas?: Record<string, SchemaObject>;
        parameters?: Record<string, ParameterObject>;
        requestBodies?: Record<string, RequestBodyObject>;
        responses?: Record<string, ResponseObject>;
    };
}

export interface PathItemObject {
    get?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    patch?: OperationObject;
    delete?: OperationObject;
    head?: OperationObject;
    options?: OperationObject;
    parameters?: ParameterObject[];
}

export interface OperationObject {
    operationId?: string;
    description?: string;
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject | ReferenceObject;
    responses?: Record<string, ResponseObject | ReferenceObject>;
}

export interface ParameterObject {
    name: string;
    in: "path" | "query" | "header" | "cookie";
    description?: string;
    schema?: SchemaObject | ReferenceObject;
}

export interface RequestBodyObject {
    description?: string;
    content?: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
    description?: string;
    content?: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
    schema?: SchemaObject | ReferenceObject;
}

export interface SchemaObject {
    type?: string;
    description?: string;
    properties?: Record<string, SchemaObject | ReferenceObject>;
    items?: SchemaObject | ReferenceObject;
    additionalProperties?: SchemaObject | ReferenceObject | boolean;
    allOf?: (SchemaObject | ReferenceObject)[];
    oneOf?: (SchemaObject | ReferenceObject)[];
    anyOf?: (SchemaObject | ReferenceObject)[];
    $ref?: string;
}

export interface ReferenceObject {
    $ref: string;
}

export function isReferenceObject(obj: unknown): obj is ReferenceObject {
    return (
        typeof obj === "object" && obj !== null && "$ref" in obj && typeof (obj as ReferenceObject).$ref === "string"
    );
}

/** Index structure for quick operationId lookups. */
export interface OperationIndex {
    byOperationId: Map<string, { path: string; method: string }>;
    byPathMethod: Map<string, string | undefined>;
}
