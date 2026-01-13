import { describe, expect, it } from "vitest";
import { generateJsonSchemaFromValue } from "../services/enhanceExample";

describe("generateJsonSchemaFromValue", () => {
    describe("primitive types", () => {
        it("should handle null", () => {
            expect(generateJsonSchemaFromValue(null)).toEqual({ type: "null" });
        });

        it("should handle undefined", () => {
            expect(generateJsonSchemaFromValue(undefined)).toEqual({});
        });

        it("should handle strings", () => {
            expect(generateJsonSchemaFromValue("hello")).toEqual({ type: "string" });
        });

        it("should handle integers", () => {
            expect(generateJsonSchemaFromValue(42)).toEqual({ type: "integer" });
        });

        it("should handle floats", () => {
            expect(generateJsonSchemaFromValue(3.14)).toEqual({ type: "number" });
        });

        it("should handle booleans", () => {
            expect(generateJsonSchemaFromValue(true)).toEqual({ type: "boolean" });
            expect(generateJsonSchemaFromValue(false)).toEqual({ type: "boolean" });
        });
    });

    describe("empty structures", () => {
        it("should handle empty object with additionalProperties: false", () => {
            const schema = generateJsonSchemaFromValue({});
            expect(schema).toEqual({
                type: "object",
                properties: {},
                additionalProperties: false
            });
        });

        it("should handle empty array", () => {
            const schema = generateJsonSchemaFromValue([]);
            expect(schema).toEqual({
                type: "array",
                items: {}
            });
        });
    });

    describe("objects", () => {
        it("should generate schema with additionalProperties: false", () => {
            const schema = generateJsonSchemaFromValue({ name: "string", id: 0 });
            expect(schema).toEqual({
                type: "object",
                properties: {
                    name: { type: "string" },
                    id: { type: "integer" }
                },
                required: ["name", "id"],
                additionalProperties: false
            });
        });

        it("should handle nested objects with additionalProperties: false at each level", () => {
            const schema = generateJsonSchemaFromValue({
                user: {
                    name: "string",
                    profile: {
                        age: 0
                    }
                }
            });
            expect(schema).toEqual({
                type: "object",
                properties: {
                    user: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            profile: {
                                type: "object",
                                properties: {
                                    age: { type: "integer" }
                                },
                                required: ["age"],
                                additionalProperties: false
                            }
                        },
                        required: ["name", "profile"],
                        additionalProperties: false
                    }
                },
                required: ["user"],
                additionalProperties: false
            });
        });
    });

    describe("arrays", () => {
        it("should generate schema from first array item", () => {
            const schema = generateJsonSchemaFromValue([{ id: 1, name: "test" }]);
            expect(schema).toEqual({
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "integer" },
                        name: { type: "string" }
                    },
                    required: ["id", "name"],
                    additionalProperties: false
                }
            });
        });

        it("should handle array of primitives", () => {
            const schema = generateJsonSchemaFromValue(["a", "b", "c"]);
            expect(schema).toEqual({
                type: "array",
                items: { type: "string" }
            });
        });
    });

    describe("real-world examples", () => {
        it("should handle typical API request example", () => {
            const requestExample = {
                method: "POST",
                path: "/users",
                body: {
                    name: "string",
                    email: "string",
                    age: 0
                }
            };
            const schema = generateJsonSchemaFromValue(requestExample);

            // Verify additionalProperties: false at all levels
            expect(schema.additionalProperties).toBe(false);
            expect((schema.properties as Record<string, unknown>).body).toMatchObject({
                additionalProperties: false
            });
        });

        it("should handle response with nested arrays", () => {
            const responseExample = {
                data: [
                    {
                        id: "string",
                        items: [{ name: "string" }]
                    }
                ],
                meta: {
                    total: 0
                }
            };
            const schema = generateJsonSchemaFromValue(responseExample);

            expect(schema.additionalProperties).toBe(false);
            // Check nested structure
            const dataItems = (schema.properties as Record<string, unknown>).data as Record<string, unknown>;
            expect(dataItems.type).toBe("array");
            const itemSchema = dataItems.items as Record<string, unknown>;
            expect(itemSchema.additionalProperties).toBe(false);
        });
    });
});
