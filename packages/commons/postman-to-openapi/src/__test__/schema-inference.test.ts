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
