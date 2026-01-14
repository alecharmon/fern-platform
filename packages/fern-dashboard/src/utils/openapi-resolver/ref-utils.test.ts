import { describe, expect, it } from "vitest";

import {
    isCompositionSchema,
    parseRef,
    type RefResolutionContext,
    resolveFilePath,
    resolveJsonPath,
    resolvePropertyPath,
    resolveRef
} from "./ref-utils";
import type { ParsedOpenApiSpec, SchemaObject } from "./types";

describe("ref-utils", () => {
    describe("parseRef", () => {
        it.each([
            ["#/components/schemas/User", "", ["components", "schemas", "User"]],
            ["./models.yaml#/User", "./models.yaml", ["User"]],
            [
                "https://example.com/spec.json#/components/schemas/Pet",
                "https://example.com/spec.json",
                ["components", "schemas", "Pet"]
            ],
            ["./models.yaml", "./models.yaml", []],
            ["./models.yaml#", "./models.yaml", []],
            ["./models.yaml#/", "./models.yaml", []],
            ["#/definitions/my~0schema", "", ["definitions", "my~schema"]],
            ["#/paths/~1users~1{id}", "", ["paths", "/users/{id}"]],
            ["#/paths/~1users~0test~1profile", "", ["paths", "/users~test/profile"]],
            ["#/", "", []]
        ])("parseRef(%s)", (ref, expectedFile, expectedPath) => {
            const result = parseRef(ref);
            expect(result.filePath).toBe(expectedFile);
            expect(result.jsonPath).toEqual(expectedPath);
        });
    });

    describe("resolveFilePath", () => {
        it.each([
            ["https://example.com/spec.yaml", "/base/file.yaml", "https://example.com/spec.yaml"],
            ["http://example.com/spec.yaml", "/base/file.yaml", "http://example.com/spec.yaml"],
            ["/absolute/path.yaml", "/base/file.yaml", "/absolute/path.yaml"],
            ["./models.yaml", "/api/spec.yaml", "/api/models.yaml"],
            ["../common/types.yaml", "/api/v1/spec.yaml", "/api/common/types.yaml"],
            ["../../shared/models.yaml", "/api/v1/spec.yaml", "/shared/models.yaml"],
            ["models.yaml", "/api/spec.yaml", "/api/models.yaml"],
            ["./sub/models.yaml", "/api/spec.yaml", "/api/sub/models.yaml"]
        ])("resolveFilePath(%s, %s) = %s", (relativePath, baseFile, expected) => {
            expect(resolveFilePath(relativePath, baseFile)).toBe(expected);
        });
    });

    describe("resolveJsonPath", () => {
        const testSpec: ParsedOpenApiSpec = {
            paths: {
                "/users": { get: { operationId: "getUsers", description: "Get all users" } }
            },
            components: {
                schemas: {
                    User: { type: "object", properties: { name: { type: "string", description: "User name" } } }
                }
            }
        };

        it("resolves paths correctly", () => {
            expect(resolveJsonPath(testSpec, ["paths"])).toHaveProperty("/users");
            expect(resolveJsonPath(testSpec, ["paths", "/users", "get", "description"])).toBe("Get all users");
            expect(
                resolveJsonPath(testSpec, ["components", "schemas", "User", "properties", "name", "description"])
            ).toBe("User name");
            expect(resolveJsonPath(testSpec, [])).toEqual(testSpec);
        });

        it("returns undefined for invalid paths", () => {
            expect(resolveJsonPath(testSpec, ["nonexistent"])).toBeUndefined();
            expect(resolveJsonPath(testSpec, ["paths", "/users", "get", "description", "nested"])).toBeUndefined();
        });

        it("handles null values in path", () => {
            const specWithNull: ParsedOpenApiSpec = {
                paths: {
                    "/test": {
                        // @ts-expect-error - Testing null handling
                        get: null
                    }
                }
            };

            const result = resolveJsonPath(specWithNull, ["paths", "/test", "get", "description"]);

            expect(result).toBeUndefined();
        });
    });

    describe("resolveRef", () => {
        it("resolves local ref", () => {
            const spec: ParsedOpenApiSpec = {
                components: {
                    schemas: {
                        User: {
                            type: "object",
                            description: "A user"
                        }
                    }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map([["spec.yaml", spec]]),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolveRef("#/components/schemas/User", context);

            expect(result).not.toBeNull();
            expect(result?.filePath).toBe("spec.yaml");
            expect(result?.jsonPath).toEqual(["components", "schemas", "User"]);
            expect(result?.value).toEqual({ type: "object", description: "A user" });
        });

        it("resolves cross-file ref", () => {
            const mainSpec: ParsedOpenApiSpec = {
                components: {
                    schemas: {
                        User: {
                            $ref: "./models.yaml#/User"
                        }
                    }
                }
            };

            const modelsSpec: ParsedOpenApiSpec = {
                User: {
                    type: "object",
                    description: "User from models file"
                }
            } as unknown as ParsedOpenApiSpec;

            const context: RefResolutionContext = {
                specs: new Map([
                    ["api/spec.yaml", mainSpec],
                    ["api/models.yaml", modelsSpec]
                ]),
                currentFile: "api/spec.yaml",
                visited: new Set()
            };

            const result = resolveRef("./models.yaml#/User", context);

            expect(result).not.toBeNull();
            expect(result?.filePath).toBe("api/models.yaml");
            expect(result?.jsonPath).toEqual(["User"]);
        });

        it("detects circular refs", () => {
            const spec: ParsedOpenApiSpec = {
                components: {
                    schemas: {
                        A: {
                            $ref: "#/components/schemas/B"
                        },
                        B: {
                            $ref: "#/components/schemas/A"
                        }
                    }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map([["spec.yaml", spec]]),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            // Start the chain
            const result = resolveRef("#/components/schemas/A", context);

            // Should return null due to cycle
            expect(result).toBeNull();
        });

        it("handles ref chains (A -> B -> C)", () => {
            const spec: ParsedOpenApiSpec = {
                components: {
                    schemas: {
                        A: {
                            $ref: "#/components/schemas/B"
                        },
                        B: {
                            $ref: "#/components/schemas/C"
                        },
                        C: {
                            type: "object",
                            description: "Final schema"
                        }
                    }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map([["spec.yaml", spec]]),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolveRef("#/components/schemas/A", context);

            expect(result).not.toBeNull();
            expect(result?.value).toEqual({ type: "object", description: "Final schema" });
            expect(result?.jsonPath).toEqual(["components", "schemas", "C"]);
        });

        it("returns null for missing external file", () => {
            const spec: ParsedOpenApiSpec = {};

            const context: RefResolutionContext = {
                specs: new Map([["spec.yaml", spec]]),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolveRef("./nonexistent.yaml#/User", context);

            expect(result).toBeNull();
        });

        it("returns null for non-existent path in spec", () => {
            const spec: ParsedOpenApiSpec = {
                components: {
                    schemas: {}
                }
            };

            const context: RefResolutionContext = {
                specs: new Map([["spec.yaml", spec]]),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolveRef("#/components/schemas/NonExistent", context);

            expect(result).toBeNull();
        });
    });

    describe("resolvePropertyPath", () => {
        it("traverses simple property path", () => {
            const schema: SchemaObject = {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Name"
                    }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["name"], context);

            expect(result).not.toBeNull();
            expect(result?.filePath).toBe("spec.yaml");
            expect(result?.jsonPath).toEqual(["properties", "name"]);
        });

        it("traverses nested property path", () => {
            const schema: SchemaObject = {
                type: "object",
                properties: {
                    address: {
                        type: "object",
                        properties: {
                            street: {
                                type: "string",
                                description: "Street"
                            }
                        }
                    }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["address", "street"], context);

            expect(result).not.toBeNull();
            // Property resolution returns the full path including intermediate properties
            expect(result?.jsonPath).toEqual(["properties", "address", "properties", "street"]);
        });

        it("follows refs in property chain", () => {
            const mainSpec: ParsedOpenApiSpec = {
                components: {
                    schemas: {
                        Address: {
                            type: "object",
                            properties: {
                                street: {
                                    type: "string",
                                    description: "Street address"
                                }
                            }
                        }
                    }
                }
            };

            const schema: SchemaObject = {
                type: "object",
                properties: {
                    address: {
                        $ref: "#/components/schemas/Address"
                    }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map([["spec.yaml", mainSpec]]),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["address", "street"], context);

            expect(result).not.toBeNull();
            expect(result?.jsonPath).toContain("street");
        });

        it("returns null for composition types (allOf)", () => {
            const schema: SchemaObject = {
                allOf: [
                    { type: "object", properties: { foo: { type: "string" } } },
                    { type: "object", properties: { bar: { type: "string" } } }
                ]
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["foo"], context);

            expect(result).toBeNull();
        });

        it("returns null for composition types (oneOf)", () => {
            const schema: SchemaObject = {
                oneOf: [
                    { type: "object", properties: { foo: { type: "string" } } },
                    { type: "object", properties: { bar: { type: "string" } } }
                ]
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["foo"], context);

            expect(result).toBeNull();
        });

        it("returns null for missing property", () => {
            const schema: SchemaObject = {
                type: "object",
                properties: {
                    name: { type: "string" }
                }
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["nonexistent"], context);

            expect(result).toBeNull();
        });

        it("returns location for empty path (target is schema itself)", () => {
            const schema: SchemaObject = {
                type: "object",
                description: "Root schema"
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, [], context);

            expect(result).not.toBeNull();
            expect(result?.filePath).toBe("spec.yaml");
            expect(result?.jsonPath).toEqual([]);
        });

        it("handles schema with no properties", () => {
            const schema: SchemaObject = {
                type: "object"
                // No properties defined
            };

            const context: RefResolutionContext = {
                specs: new Map(),
                currentFile: "spec.yaml",
                visited: new Set()
            };

            const result = resolvePropertyPath(schema, ["name"], context);

            expect(result).toBeNull();
        });
    });

    describe("isCompositionSchema", () => {
        it("returns true for allOf schema", () => {
            const schema: SchemaObject = {
                allOf: [{ type: "object" }, { type: "object" }]
            };

            expect(isCompositionSchema(schema)).toBe(true);
        });

        it("returns true for oneOf schema", () => {
            const schema: SchemaObject = {
                oneOf: [{ type: "string" }, { type: "number" }]
            };

            expect(isCompositionSchema(schema)).toBe(true);
        });

        it("returns true for anyOf schema", () => {
            const schema: SchemaObject = {
                anyOf: [{ type: "string" }, { type: "number" }]
            };

            expect(isCompositionSchema(schema)).toBe(true);
        });

        it("returns false for simple object schema", () => {
            const schema: SchemaObject = {
                type: "object",
                properties: {
                    name: { type: "string" }
                }
            };

            expect(isCompositionSchema(schema)).toBe(false);
        });

        it("returns false for $ref schema", () => {
            const refSchema = { $ref: "#/components/schemas/User" };

            expect(isCompositionSchema(refSchema)).toBe(false);
        });

        it("returns false for primitive schema", () => {
            const schema: SchemaObject = {
                type: "string"
            };

            expect(isCompositionSchema(schema)).toBe(false);
        });
    });
});
