import type { OpenAPISchema } from "./openapi-types.js";

/**
 * Infers an OpenAPI schema from a JSON value.
 */
export function inferSchema(value: unknown): OpenAPISchema {
    if (value === null) {
        return { type: ["null"] };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return { type: "array", items: {} };
        }
        const itemSchema = inferSchema(value[0]);
        return { type: "array", items: itemSchema };
    }

    switch (typeof value) {
        case "string":
            return inferStringSchema(value);
        case "number":
            return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
        case "boolean":
            return { type: "boolean" };
        case "object":
            return inferObjectSchema(value as Record<string, unknown>);
        default:
            return {};
    }
}

/**
 * Infers a string schema, detecting common formats.
 */
function inferStringSchema(value: string): OpenAPISchema {
    if (isDateTimeString(value)) {
        return { type: "string", format: "date-time" };
    }
    if (isDateString(value)) {
        return { type: "string", format: "date" };
    }
    if (isEmailString(value)) {
        return { type: "string", format: "email" };
    }
    if (isUuidString(value)) {
        return { type: "string", format: "uuid" };
    }
    if (isUrlString(value)) {
        return { type: "string", format: "uri" };
    }
    return { type: "string" };
}

/**
 * Valid JSON Schema type values.
 */
const VALID_SCHEMA_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object", "null"]);

/**
 * Checks if an object looks like a JSON Schema / OpenAPI schema definition
 * rather than a plain data object. This handles cases where Postman examples
 * contain values that are themselves schema definitions (e.g. from Tableau APIs).
 */
function looksLikeSchemaDefinition(obj: Record<string, unknown>): boolean {
    const typeValue = obj.type;
    if (typeof typeValue !== "string" || !VALID_SCHEMA_TYPES.has(typeValue)) {
        return false;
    }

    // An object with a valid `type` AND schema-specific structural keywords is likely a schema
    const hasProperties =
        typeof obj.properties === "object" && obj.properties !== null && !Array.isArray(obj.properties);
    const hasItems = typeof obj.items === "object" && obj.items !== null;
    const hasEnum = Array.isArray(obj.enum);
    const hasOneOf = Array.isArray(obj.oneOf);
    const hasAnyOf = Array.isArray(obj.anyOf);
    const hasAllOf = Array.isArray(obj.allOf);

    return hasProperties || hasItems || hasEnum || hasOneOf || hasAnyOf || hasAllOf;
}

/**
 * Converts an object that looks like a JSON Schema definition into an OpenAPISchema,
 * recursively handling nested schema-like objects within `properties` and `items`.
 */
function convertSchemaLikeObject(obj: Record<string, unknown>): OpenAPISchema {
    const schema: OpenAPISchema = {};

    if (typeof obj.type === "string") {
        schema.type = obj.type;
    }

    if (typeof obj.format === "string") {
        schema.format = obj.format;
    }

    if (typeof obj.description === "string") {
        schema.description = obj.description;
    }

    if (obj.default !== undefined) {
        schema.default = obj.default;
    }

    if (Array.isArray(obj.required)) {
        schema.required = obj.required.filter((r): r is string => typeof r === "string");
    }

    if (Array.isArray(obj.enum)) {
        schema.enum = obj.enum;
    }

    if (typeof obj.properties === "object" && obj.properties !== null && !Array.isArray(obj.properties)) {
        const properties: Record<string, OpenAPISchema> = {};
        for (const [key, val] of Object.entries(obj.properties as Record<string, unknown>)) {
            if (
                typeof val === "object" &&
                val !== null &&
                !Array.isArray(val) &&
                looksLikeSchemaDefinition(val as Record<string, unknown>)
            ) {
                properties[key] = convertSchemaLikeObject(val as Record<string, unknown>);
            } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
                // Might be a simple schema like { "type": "string" }
                const valObj = val as Record<string, unknown>;
                if (typeof valObj.type === "string" && VALID_SCHEMA_TYPES.has(valObj.type)) {
                    properties[key] = convertSchemaLikeObject(valObj);
                } else {
                    properties[key] = inferSchema(val);
                }
            } else {
                properties[key] = inferSchema(val);
            }
        }
        schema.properties = properties;
    }

    if (typeof obj.items === "object" && obj.items !== null && !Array.isArray(obj.items)) {
        const itemsObj = obj.items as Record<string, unknown>;
        if (looksLikeSchemaDefinition(itemsObj)) {
            schema.items = convertSchemaLikeObject(itemsObj);
        } else if (typeof itemsObj.type === "string" && VALID_SCHEMA_TYPES.has(itemsObj.type)) {
            schema.items = convertSchemaLikeObject(itemsObj);
        } else {
            schema.items = inferSchema(obj.items);
        }
    }

    return schema;
}

/**
 * Infers an object schema from key-value pairs.
 */
function inferObjectSchema(obj: Record<string, unknown>): OpenAPISchema {
    // Detect objects that look like JSON Schema definitions and pass them through
    if (looksLikeSchemaDefinition(obj)) {
        return convertSchemaLikeObject(obj);
    }

    const properties: Record<string, OpenAPISchema> = {};
    const requiredKeys: string[] = [];

    for (const [key, val] of Object.entries(obj)) {
        properties[key] = inferSchema(val);
        if (val != null) {
            requiredKeys.push(key);
        }
    }

    const schema: OpenAPISchema = { type: "object", properties };
    if (requiredKeys.length > 0) {
        schema.required = requiredKeys;
    }
    return schema;
}

/**
 * Infers a schema from a JSON string body, returning schema and parsed example.
 */
export function inferSchemaFromJsonString(body: string): { schema: OpenAPISchema; example: unknown } | undefined {
    try {
        const parsed: unknown = JSON.parse(body);
        return { schema: inferSchema(parsed), example: parsed };
    } catch {
        return undefined;
    }
}

function isDateTimeString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

function isDateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isEmailString(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuidString(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isUrlString(value: string): boolean {
    return /^https?:\/\//.test(value);
}
