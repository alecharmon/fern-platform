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
 * Infers an object schema from key-value pairs.
 */
function inferObjectSchema(obj: Record<string, unknown>): OpenAPISchema {
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
