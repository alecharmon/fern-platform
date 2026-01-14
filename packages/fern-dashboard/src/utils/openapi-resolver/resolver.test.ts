import { describe, expect, it } from "vitest";

import {
    EMPTY_OVERRIDE,
    OVERRIDE_MAIN_SPEC,
    OVERRIDE_SPEC,
    OVERRIDE_WITH_COMPONENT_VALUES,
    OVERRIDE_WITH_INLINE_PROPS,
    SIMPLE_SPEC,
    SPEC_WITH_ARRAY_RESPONSE,
    SPEC_WITH_COMPOSITION,
    SPEC_WITH_PATH_LEVEL_PARAMS,
    SPEC_WITH_REFS,
    SPEC_WITH_RESPONSE_REF
} from "./__fixtures__/specs";
import { createResolver, OpenApiResolver } from "./resolver";
import type { DescriptionTarget } from "./types";

// Helper for creating resolver with common spec
const createSimpleResolver = () => new OpenApiResolver(new Map([["spec.yaml", SIMPLE_SPEC]]));

describe("OpenApiResolver", () => {
    describe("constructor and parsing", () => {
        it("creates resolver from valid specs", () => {
            expect(createSimpleResolver()).toBeInstanceOf(OpenApiResolver);
            const jsonSpec = JSON.stringify({
                openapi: "3.0.0",
                paths: { "/test": { get: { operationId: "testOp" } } }
            });
            expect(
                new OpenApiResolver(new Map([["spec.json", jsonSpec]])).resolve({
                    type: "endpoint",
                    method: "GET",
                    path: "/test"
                }).location
            ).not.toBeNull();
        });

        it("handles invalid spec gracefully", () => {
            expect(new OpenApiResolver(new Map([["invalid.yaml", "{{{invalid"]]))).toBeInstanceOf(OpenApiResolver);
        });
    });

    describe("endpoint resolution", () => {
        it.each([
            [
                { type: "endpoint", operationId: "getUser", method: "GET", path: "/users/{id}" },
                ["paths", "/users/{id}", "get", "description"]
            ],
            [{ type: "endpoint", method: "POST", path: "/users/{id}" }, ["paths", "/users/{id}", "post", "description"]]
        ] as [DescriptionTarget, string[]][])("resolves endpoint %j", (target, expectedPath) => {
            const result = createSimpleResolver().resolve(target);
            expect(result.location).not.toBeNull();
            expect(result.location?.jsonPath).toEqual(expectedPath);
        });

        it("returns not-found for missing endpoint", () => {
            const result = createSimpleResolver().resolve({
                type: "endpoint",
                operationId: "nonExistent",
                method: "GET",
                path: "/nonexistent"
            });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("schema resolution", () => {
        it.each([
            [SIMPLE_SPEC, "User", ["components", "schemas", "User", "description"], null],
            [SPEC_WITH_REFS, "RefSchema", ["components", "schemas", "ActualSchema", "description"], null],
            [SPEC_WITH_COMPOSITION, "ExtendedUser", null, "composition-type"],
            [SPEC_WITH_COMPOSITION, "OneOfExample", null, "composition-type"],
            [SIMPLE_SPEC, "NonExistent", null, "not-found"]
        ])("schema resolution for typeId=%s", (spec, typeId, expectedPath, expectedReason) => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", spec]]));
            const result = resolver.resolve({ type: "schema", typeId });
            if (expectedPath) {
                expect(result.location?.jsonPath).toEqual(expectedPath);
            } else {
                expect(result.location).toBeNull();
                expect(result.reason).toBe(expectedReason);
            }
        });
    });

    describe("property resolution", () => {
        it.each([
            [["name"], ["components", "schemas", "User", "properties", "name", "description"]],
            [
                ["address", "street"],
                ["components", "schemas", "User", "properties", "address", "properties", "street", "description"]
            ],
            [[], ["components", "schemas", "User", "description"]]
        ])("resolves property path %j", (propertyPath, expectedPath) => {
            const result = createSimpleResolver().resolve({ type: "property", typeId: "User", propertyPath });
            expect(result.location?.jsonPath).toEqual(expectedPath);
        });

        it("returns not-found for missing property", () => {
            const result = createSimpleResolver().resolve({
                type: "property",
                typeId: "User",
                propertyPath: ["nonexistent"]
            });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("parameter resolution", () => {
        it.each([
            ["id", "path", ["paths", "/users/{id}", "get", "parameters", "0", "description"]],
            ["include", "query", ["paths", "/users/{id}", "get", "parameters", "1", "description"]],
            ["X-Request-ID", "header", ["paths", "/users/{id}", "get", "parameters", "2", "description"]]
        ] as const)("resolves %s parameter (in=%s)", (paramName, paramIn, expectedPath) => {
            const result = createSimpleResolver().resolve({
                type: "parameter",
                operationId: "getUser",
                method: "GET",
                path: "/users/{id}",
                paramName,
                paramIn
            });
            expect(result.location?.jsonPath).toEqual(expectedPath);
        });

        it("falls back to path-level parameters", () => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", SPEC_WITH_PATH_LEVEL_PARAMS]]));
            const result = resolver.resolve({
                type: "parameter",
                operationId: "getItem",
                method: "GET",
                path: "/items/{itemId}",
                paramName: "itemId",
                paramIn: "path"
            });
            expect(result.location?.jsonPath).toEqual(["paths", "/items/{itemId}", "parameters", "0", "description"]);
        });

        it("returns not-found for missing parameter", () => {
            const result = createSimpleResolver().resolve({
                type: "parameter",
                operationId: "getUser",
                method: "GET",
                path: "/users/{id}",
                paramName: "nonexistent",
                paramIn: "query"
            });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("requestBody resolution", () => {
        it.each([
            [
                SIMPLE_SPEC,
                { operationId: "createUser", method: "POST", path: "/users/{id}" },
                ["paths", "/users/{id}", "post", "requestBody", "description"]
            ],
            [
                SPEC_WITH_REFS,
                { operationId: "createProduct", method: "POST", path: "/products" },
                ["components", "requestBodies", "CreateProduct", "description"]
            ]
        ])("resolves requestBody", (spec, target, expectedPath) => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", spec]]));
            const result = resolver.resolve({ type: "requestBody", ...target });
            expect(result.location?.jsonPath).toEqual(expectedPath);
        });

        it("returns not-found when no requestBody", () => {
            const result = createSimpleResolver().resolve({
                type: "requestBody",
                operationId: "getUser",
                method: "GET",
                path: "/users/{id}"
            });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("response resolution", () => {
        it.each([
            [SIMPLE_SPEC, 200, ["paths", "/users/{id}", "get", "responses", "200", "description"]],
            [SIMPLE_SPEC, 404, ["paths", "/users/{id}", "get", "responses", "404", "description"]]
        ])("resolves response statusCode=%s", (spec, statusCode, expectedPath) => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", spec]]));
            const result = resolver.resolve({
                type: "response",
                operationId: "getUser",
                method: "GET",
                path: "/users/{id}",
                statusCode
            });
            expect(result.location?.jsonPath).toEqual(expectedPath);
        });

        it("follows $ref for response", () => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", SPEC_WITH_REFS]]));
            const result = resolver.resolve({
                type: "response",
                operationId: "createProduct",
                method: "POST",
                path: "/products",
                statusCode: 200
            });
            expect(result.location?.jsonPath).toEqual(["components", "responses", "ProductResponse", "description"]);
        });

        it("returns not-found for missing status code", () => {
            const result = createSimpleResolver().resolve({
                type: "response",
                operationId: "getUser",
                method: "GET",
                path: "/users/{id}",
                statusCode: 500
            });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("enumValue resolution", () => {
        it("resolves enum value to x-enum-descriptions path", () => {
            const result = createSimpleResolver().resolve({ type: "enumValue", typeId: "Status", enumValue: "ACTIVE" });
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "Status",
                "x-enum-descriptions",
                "ACTIVE"
            ]);
        });

        it.each([
            ["Status", "NONEXISTENT"],
            ["User", "ACTIVE"]
        ])("returns not-found for invalid enum (typeId=%s, value=%s)", (typeId, enumValue) => {
            const result = createSimpleResolver().resolve({ type: "enumValue", typeId, enumValue });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("formDataField resolution", () => {
        const formDataPath = [
            "paths",
            "/files",
            "post",
            "requestBody",
            "content",
            "multipart/form-data",
            "schema",
            "properties"
        ];

        it.each([
            ["document", "file", [...formDataPath, "document", "description"]],
            ["metadata", "property", [...formDataPath, "metadata", "description"]]
        ] as const)("resolves formDataField %s (type=%s)", (fieldKey, fieldType, expectedPath) => {
            const result = createSimpleResolver().resolve({
                type: "formDataField",
                operationId: "uploadFile",
                method: "POST",
                path: "/files",
                fieldKey,
                fieldType
            });
            expect(result.location?.jsonPath).toEqual(expectedPath);
        });

        it.each([
            [
                {
                    operationId: "createUser",
                    method: "POST",
                    path: "/users/{id}",
                    fieldKey: "name",
                    fieldType: "property" as const
                }
            ],
            [
                {
                    operationId: "uploadFile",
                    method: "POST",
                    path: "/files",
                    fieldKey: "nonexistent",
                    fieldType: "file" as const
                }
            ]
        ])("returns not-found for invalid formDataField", (target) => {
            const result = createSimpleResolver().resolve({ type: "formDataField", ...target });
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });
    });

    describe("override file priority", () => {
        const endpointTarget = { type: "endpoint" as const, operationId: "getUsers", method: "GET", path: "/users" };

        it("prefers override file over main spec", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", OVERRIDE_MAIN_SPEC],
                    ["override.yaml", OVERRIDE_SPEC]
                ]),
                new Set(["override.yaml"])
            );
            const result = resolver.resolve(endpointTarget);
            expect(result.location?.filePath).toBe("override.yaml");
            expect(result.location?.isInOverride).toBe(true);
        });

        it("falls back to main spec when not in override", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", OVERRIDE_MAIN_SPEC],
                    ["override.yaml", EMPTY_OVERRIDE]
                ]),
                new Set(["override.yaml"])
            );
            const result = resolver.resolve(endpointTarget);
            expect(result.location?.filePath).toBe("main.yaml");
            expect(result.location?.isInOverride).toBe(false);
        });

        it("works with any filename as override (not just 'override.yaml')", () => {
            // Customers can name their override file anything - we detect via generators.yml
            const resolver = new OpenApiResolver(
                new Map([
                    ["openapi.yaml", OVERRIDE_MAIN_SPEC],
                    ["my-custom-overrides.yml", OVERRIDE_SPEC]
                ]),
                new Set(["my-custom-overrides.yml"]) // This comes from generators.yml parsing
            );
            const result = resolver.resolve(endpointTarget);
            expect(result.location?.filePath).toBe("my-custom-overrides.yml");
            expect(result.location?.isInOverride).toBe(true);
        });
    });

    describe("createResolver helper", () => {
        it.each([
            [null, null],
            [new Map(), null],
            [new Map([["spec.yaml", SIMPLE_SPEC]]), OpenApiResolver]
        ])("createResolver(%s)", (specs, expectedType) => {
            const resolver = createResolver(specs);
            if (expectedType) {
                expect(resolver).toBeInstanceOf(expectedType);
            } else {
                expect(resolver).toBeNull();
            }
        });
    });

    describe("resolveWriteLocation", () => {
        const endpointTarget = { type: "endpoint" as const, operationId: "getUsers", method: "GET", path: "/users" };
        const schemaTarget = { type: "schema" as const, typeId: "User" };

        it("returns existing override location when available", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", OVERRIDE_MAIN_SPEC],
                    ["override.yaml", OVERRIDE_SPEC]
                ]),
                new Set(["override.yaml"])
            );
            const result = resolver.resolveWriteLocation(endpointTarget, true);
            expect(result.location?.filePath).toBe("override.yaml");
            expect(result.location?.isInOverride).toBe(true);
            expect(result.needsOverrideFile).toBeUndefined();
        });

        it("returns main spec location when preferOverrides=false", () => {
            const resolver = new OpenApiResolver(new Map([["main.yaml", OVERRIDE_MAIN_SPEC]]));
            const result = resolver.resolveWriteLocation(endpointTarget, false);
            expect(result.location?.filePath).toBe("main.yaml");
            expect(result.location?.isInOverride).toBe(false);
        });

        it("signals needsOverrideFile when no override exists", () => {
            const resolver = new OpenApiResolver(new Map([["openapi/openapi.yaml", OVERRIDE_MAIN_SPEC]]));
            const result = resolver.resolveWriteLocation(endpointTarget, true);
            expect(result.needsOverrideFile).toBe(true);
            expect(result.suggestedOverridePath).toBe("openapi/openapi-overrides.yaml");
        });

        it("signals needsStructureCreation when override exists but path not present", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", OVERRIDE_MAIN_SPEC],
                    ["override.yaml", EMPTY_OVERRIDE]
                ]),
                new Set(["override.yaml"])
            );
            const result = resolver.resolveWriteLocation(schemaTarget, true);
            expect(result.location?.filePath).toBe("override.yaml");
            expect(result.needsStructureCreation).toBe(true);
        });

        it("returns not-found when target doesn't exist", () => {
            const resolver = new OpenApiResolver(new Map([["main.yaml", OVERRIDE_MAIN_SPEC]]));
            const result = resolver.resolveWriteLocation(
                { type: "endpoint", operationId: "nonExistent", method: "GET", path: "/nonexistent" },
                true
            );
            expect(result.location).toBeNull();
            expect(result.reason).toBe("not-found");
        });

        it.each([
            ["fern/openapi/petstore.yaml", "fern/openapi/openapi-overrides.yaml"],
            ["spec.yaml", "openapi-overrides.yaml"],
            ["fern/openapi/petstore.yml", "fern/openapi/openapi-overrides.yaml"],
            // JSON specs should get JSON override files
            ["openapi/spec.json", "openapi/openapi-overrides.json"],
            ["fern/api/openapi.json", "fern/api/openapi-overrides.json"],
            ["spec.json", "openapi-overrides.json"]
        ])("suggests override path for %s", (specPath, expectedOverridePath) => {
            const resolver = new OpenApiResolver(new Map([[specPath, OVERRIDE_MAIN_SPEC]]));
            const result = resolver.resolveWriteLocation(endpointTarget, true);
            expect(result.needsOverrideFile).toBe(true);
            expect(result.suggestedOverridePath).toBe(expectedOverridePath);
        });
    });

    describe("$ref schema override handling", () => {
        // Test that when a request/response body uses $ref to a component schema,
        // overrides write to the component schema (not inline) because OpenAPI merge
        // tools don't deep-merge across $ref boundaries

        it("does not generate inlineJsonPath for request body property with $ref schema", () => {
            const resolver = createSimpleResolver();
            const target = {
                type: "requestBodyProperty" as const,
                operationId: "createUser",
                method: "POST",
                path: "/users/{id}",
                propertyPath: ["name"]
            };
            const result = resolver.resolve(target);

            // Should resolve to the component schema location for reading
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "User",
                "properties",
                "name",
                "description"
            ]);

            // For $ref schemas, inlineJsonPath should NOT be set
            // This ensures overrides write to the component schema, not inline
            expect(result.location?.inlineJsonPath).toBeUndefined();
        });

        it("does not generate inlineJsonPath for nested request body property with $ref schema", () => {
            const resolver = createSimpleResolver();
            const target = {
                type: "requestBodyProperty" as const,
                operationId: "createUser",
                method: "POST",
                path: "/users/{id}",
                propertyPath: ["address", "street"]
            };
            const result = resolver.resolve(target);

            // Should resolve to the nested property in component schema
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "User",
                "properties",
                "address",
                "properties",
                "street",
                "description"
            ]);

            // For $ref schemas, inlineJsonPath should NOT be set
            expect(result.location?.inlineJsonPath).toBeUndefined();
        });

        it("does not generate inlineJsonPath for inline schema (no $ref)", () => {
            const resolver = createSimpleResolver();
            const target = {
                type: "formDataField" as const,
                operationId: "uploadFile",
                method: "POST",
                path: "/files",
                fieldKey: "document",
                fieldType: "file" as const
            };
            const result = resolver.resolve(target);

            // Inline schema should not have inlineJsonPath (formDataField uses a different code path)
            expect(result.location?.inlineJsonPath).toBeUndefined();
        });

        it("writes to component schema path for $ref schemas in resolveWriteLocation", () => {
            const resolver = new OpenApiResolver(new Map([["openapi/openapi.yaml", SIMPLE_SPEC]]), new Set());
            const target = {
                type: "requestBodyProperty" as const,
                operationId: "createUser",
                method: "POST",
                path: "/users/{id}",
                propertyPath: ["name"]
            };

            const writeResult = resolver.resolveWriteLocation(target, true);

            // When writing to override, should use component schema path (not inline)
            // because OpenAPI merge tools don't deep-merge across $ref boundaries
            expect(writeResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "User",
                "properties",
                "name",
                "description"
            ]);
            expect(writeResult.needsOverrideFile).toBe(true);
        });

        it("writes to component schema when writing to existing override file for $ref schemas", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", SIMPLE_SPEC],
                    ["override.yaml", EMPTY_OVERRIDE]
                ]),
                new Set(["override.yaml"])
            );
            const target = {
                type: "requestBodyProperty" as const,
                operationId: "createUser",
                method: "POST",
                path: "/users/{id}",
                propertyPath: ["name"]
            };

            const writeResult = resolver.resolveWriteLocation(target, true);

            // Should write to override file with component schema path
            expect(writeResult.location?.filePath).toBe("override.yaml");
            expect(writeResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "User",
                "properties",
                "name",
                "description"
            ]);
            expect(writeResult.needsStructureCreation).toBe(true);
        });

        it("does not generate inlineJsonPath for response body property with $ref schema", () => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", SPEC_WITH_RESPONSE_REF]]));
            const target = {
                type: "responseProperty" as const,
                operationId: "addPlant",
                method: "POST",
                path: "/plant",
                statusCode: 200,
                propertyPath: ["name"]
            };
            const result = resolver.resolve(target);

            // Should resolve to the component schema location for reading
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "name",
                "description"
            ]);

            // For $ref schemas, inlineJsonPath should NOT be set
            expect(result.location?.inlineJsonPath).toBeUndefined();
        });

        it("writes to component schema for response property with $ref in resolveWriteLocation", () => {
            const resolver = new OpenApiResolver(
                new Map([["openapi/openapi.yaml", SPEC_WITH_RESPONSE_REF]]),
                new Set()
            );
            const target = {
                type: "responseProperty" as const,
                operationId: "addPlant",
                method: "POST",
                path: "/plant",
                statusCode: 200,
                propertyPath: ["id"]
            };

            const writeResult = resolver.resolveWriteLocation(target, true);

            // When writing to override, should use component schema path (not inline)
            expect(writeResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);
            expect(writeResult.needsOverrideFile).toBe(true);
            expect(writeResult.suggestedOverridePath).toBe("openapi/openapi-overrides.yaml");
        });

        it("detects $ref from main spec even when override has inline properties", () => {
            // This tests the key scenario: main spec has $ref, override has invalid inline props
            // The resolver should detect the $ref from the main spec and read from component schema
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", SPEC_WITH_RESPONSE_REF],
                    ["override.yaml", OVERRIDE_WITH_INLINE_PROPS]
                ]),
                new Set(["override.yaml"])
            );
            const target = {
                type: "responseProperty" as const,
                operationId: "addPlant",
                method: "POST",
                path: "/plant",
                statusCode: 200,
                propertyPath: ["id"]
            };

            const result = resolver.resolve(target);

            // Should read from component schema path (AA), not inline override (CC)
            // because the main spec uses $ref
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);
            // Should NOT have inlineJsonPath since it's a $ref schema
            expect(result.location?.inlineJsonPath).toBeUndefined();
        });

        it("resolveWriteLocation uses component path when override has inline props but main spec has $ref", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", SPEC_WITH_RESPONSE_REF],
                    ["override.yaml", OVERRIDE_WITH_INLINE_PROPS]
                ]),
                new Set(["override.yaml"])
            );
            const target = {
                type: "responseProperty" as const,
                operationId: "addPlant",
                method: "POST",
                path: "/plant",
                statusCode: 200,
                propertyPath: ["id"]
            };

            const writeResult = resolver.resolveWriteLocation(target, true);

            // Should write to component schema path in override file
            expect(writeResult.location?.filePath).toBe("override.yaml");
            expect(writeResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);
        });
    });

    describe("array response schema with $ref items", () => {
        // Tests for endpoints that return arrays where items use $ref to component schemas

        it("resolves response property from array schema with $ref items", () => {
            const resolver = new OpenApiResolver(new Map([["spec.yaml", SPEC_WITH_ARRAY_RESPONSE]]));
            const target = {
                type: "responseProperty" as const,
                operationId: "searchPlantsByStatus",
                method: "GET",
                path: "/plant/search/status",
                statusCode: 200,
                propertyPath: ["id"]
            };
            const result = resolver.resolve(target);

            // Should resolve to the component schema location
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);
            // For $ref schemas (including array items), inlineJsonPath should NOT be set
            expect(result.location?.inlineJsonPath).toBeUndefined();
        });

        it("reads component schema values for array response properties", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", SPEC_WITH_ARRAY_RESPONSE],
                    ["override.yaml", OVERRIDE_WITH_COMPONENT_VALUES]
                ]),
                new Set(["override.yaml"])
            );
            const target = {
                type: "responseProperty" as const,
                operationId: "searchPlantsByStatus",
                method: "GET",
                path: "/plant/search/status",
                statusCode: 200,
                propertyPath: ["id"]
            };

            const result = resolver.resolve(target);

            // Should resolve to override file's component schema (where AA is defined)
            expect(result.location?.filePath).toBe("override.yaml");
            expect(result.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);
        });

        it("resolves multiple properties from array response schema", () => {
            const resolver = new OpenApiResolver(
                new Map([
                    ["main.yaml", SPEC_WITH_ARRAY_RESPONSE],
                    ["override.yaml", OVERRIDE_WITH_COMPONENT_VALUES]
                ]),
                new Set(["override.yaml"])
            );

            // Check id property
            const idResult = resolver.resolve({
                type: "responseProperty" as const,
                operationId: "searchPlantsByStatus",
                method: "GET",
                path: "/plant/search/status",
                statusCode: 200,
                propertyPath: ["id"]
            });
            expect(idResult.location?.filePath).toBe("override.yaml");
            expect(idResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);

            // Check name property
            const nameResult = resolver.resolve({
                type: "responseProperty" as const,
                operationId: "searchPlantsByStatus",
                method: "GET",
                path: "/plant/search/status",
                statusCode: 200,
                propertyPath: ["name"]
            });
            expect(nameResult.location?.filePath).toBe("override.yaml");
            expect(nameResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "name",
                "description"
            ]);
        });

        it("uses component path for resolveWriteLocation with array response", () => {
            const resolver = new OpenApiResolver(
                new Map([["openapi/openapi.yaml", SPEC_WITH_ARRAY_RESPONSE]]),
                new Set()
            );
            const target = {
                type: "responseProperty" as const,
                operationId: "searchPlantsByStatus",
                method: "GET",
                path: "/plant/search/status",
                statusCode: 200,
                propertyPath: ["id"]
            };

            const writeResult = resolver.resolveWriteLocation(target, true);

            // Should use component schema path (not inline)
            expect(writeResult.location?.jsonPath).toEqual([
                "components",
                "schemas",
                "PlantResponse",
                "properties",
                "id",
                "description"
            ]);
            expect(writeResult.needsOverrideFile).toBe(true);
        });
    });
});
