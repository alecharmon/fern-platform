import { describe, expect, it } from "vitest";

import { inferSchema, inferSchemaFromJsonString } from "../schema-inference.js";

describe("inferSchema", () => {
    it("infers null as type array with null", () => {
        expect(inferSchema(null)).toEqual({ type: ["null"] });
    });

    it("infers string type", () => {
        expect(inferSchema("hello")).toEqual({ type: "string" });
    });

    it("infers integer type", () => {
        expect(inferSchema(42)).toEqual({ type: "integer" });
    });

    it("infers number type for floats", () => {
        expect(inferSchema(3.14)).toEqual({ type: "number" });
    });

    it("infers boolean type", () => {
        expect(inferSchema(true)).toEqual({ type: "boolean" });
    });

    it("infers date-time format", () => {
        expect(inferSchema("2024-01-15T10:30:00Z")).toEqual({ type: "string", format: "date-time" });
    });

    it("infers date format", () => {
        expect(inferSchema("2024-01-15")).toEqual({ type: "string", format: "date" });
    });

    it("infers email format", () => {
        expect(inferSchema("user@example.com")).toEqual({ type: "string", format: "email" });
    });

    it("infers uuid format", () => {
        expect(inferSchema("550e8400-e29b-41d4-a716-446655440000")).toEqual({ type: "string", format: "uuid" });
    });

    it("infers uri format", () => {
        expect(inferSchema("https://example.com")).toEqual({ type: "string", format: "uri" });
    });

    it("infers object with properties", () => {
        const result = inferSchema({ name: "John", age: 30 });
        expect(result).toEqual({
            type: "object",
            properties: {
                name: { type: "string" },
                age: { type: "integer" }
            },
            required: ["name", "age"]
        });
    });

    it("excludes null values from required", () => {
        const result = inferSchema({ name: "John", nickname: null });
        expect(result.required).toEqual(["name"]);
    });

    it("infers array type", () => {
        const result = inferSchema([1, 2, 3]);
        expect(result).toEqual({
            type: "array",
            items: { type: "integer" }
        });
    });

    it("infers empty array", () => {
        expect(inferSchema([])).toEqual({
            type: "array",
            items: {}
        });
    });

    it("infers nested objects", () => {
        const result = inferSchema({
            user: { name: "John", email: "john@example.com" }
        });
        expect(result.properties?.user).toEqual({
            type: "object",
            properties: {
                name: { type: "string" },
                email: { type: "string", format: "email" }
            },
            required: ["name", "email"]
        });
    });

    it("detects schema-like objects with type+properties and passes them through", () => {
        const result = inferSchema({
            type: "object",
            properties: {
                id: {
                    type: "string",
                    default: "<string>",
                    description: "The LUID of the metric."
                }
            }
        });
        expect(result).toEqual({
            type: "object",
            properties: {
                id: {
                    type: "string",
                    default: "<string>",
                    description: "The LUID of the metric."
                }
            }
        });
    });

    it("detects schema-like objects with type+items and passes them through", () => {
        const result = inferSchema({
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" }
                }
            }
        });
        expect(result).toEqual({
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" }
                }
            }
        });
    });

    it("handles deeply nested schema-like example without infinite recursion (Tableau bug)", () => {
        const tableauExample = {
            offset: "<integer>",
            definitions: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        metrics: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: {
                                        type: "string",
                                        default: "<string>",
                                        description: "The LUID of the metric."
                                    },
                                    is_default: {
                                        type: "boolean",
                                        default: "<boolean>",
                                        description: "If true, the metric is the default metric."
                                    },
                                    definition_id: {
                                        type: "string",
                                        default: "<string>",
                                        description: "The LUID of the definition."
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        const result = inferSchema(tableauExample);

        // The top-level should be inferred as an object with offset and definitions
        expect(result.type).toBe("object");
        expect(result.properties?.offset).toEqual({ type: "string" });

        // definitions should be passed through as a schema definition, not recursively inferred
        const definitions = result.properties?.definitions;
        expect(definitions?.type).toBe("array");
        expect(definitions?.items?.type).toBe("object");

        // Verify metrics are preserved as schema structure
        const metrics = definitions?.items?.properties?.metrics;
        expect(metrics?.type).toBe("array");
        expect(metrics?.items?.type).toBe("object");
        expect(metrics?.items?.properties?.id?.type).toBe("string");
        expect(metrics?.items?.properties?.id?.description).toBe("The LUID of the metric.");
        expect(metrics?.items?.properties?.is_default?.type).toBe("boolean");

        // Ensure no infinite nesting — metrics.items.properties should NOT have type/properties keys repeating
        const idProp = metrics?.items?.properties?.id;
        expect(idProp?.properties).toBeUndefined();
        expect(idProp?.items).toBeUndefined();
    });

    it("does not treat plain objects with a 'type' key but no schema keywords as schemas", () => {
        const result = inferSchema({
            type: "premium",
            name: "Gold Plan"
        });
        // "premium" is not a valid schema type, so this is a regular object
        expect(result).toEqual({
            type: "object",
            properties: {
                type: { type: "string" },
                name: { type: "string" }
            },
            required: ["type", "name"]
        });
    });

    it("handles schema-like object with enum", () => {
        const result = inferSchema({
            type: "string",
            enum: ["active", "inactive", "pending"]
        });
        expect(result).toEqual({
            type: "string",
            enum: ["active", "inactive", "pending"]
        });
    });
});

describe("inferSchemaFromJsonString", () => {
    it("parses valid JSON and infers schema", () => {
        const result = inferSchemaFromJsonString('{"name": "John", "age": 30}');
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("object");
        expect(result!.example).toEqual({ name: "John", age: 30 });
    });

    it("returns undefined for invalid JSON", () => {
        expect(inferSchemaFromJsonString("not json")).toBeUndefined();
    });

    it("handles JSON arrays", () => {
        const result = inferSchemaFromJsonString('[{"id": 1}, {"id": 2}]');
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("array");
    });

    it("handles JSON primitives", () => {
        const result = inferSchemaFromJsonString('"hello"');
        expect(result).toBeDefined();
        expect(result!.schema.type).toBe("string");
    });
});
