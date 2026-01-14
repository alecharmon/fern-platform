import { describe, expect, it } from "vitest";

import { createOverrideContent, createParameterOverrideContent, getYamlValue, updateYamlValue } from "./yaml-utils";

describe("yaml-utils", () => {
    describe("updateYamlValue", () => {
        describe("format detection", () => {
            it("detects YAML content correctly", () => {
                const yamlContent = `openapi: 3.0.0
info:
  title: Test API
`;
                const result = updateYamlValue(yamlContent, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toContain("openapi:");
                expect(result.content).toContain("description: New description");
                // Should not have JSON braces
                expect(result.content).not.toMatch(/^\s*\{/);
            });

            it("detects JSON content correctly", () => {
                const jsonContent = JSON.stringify({ info: { title: "Test API" } }, null, 2);
                const result = updateYamlValue(jsonContent, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toMatch(/^\s*\{/);
                // Parse and verify
                const parsed = JSON.parse(result.content!);
                expect(parsed.info.description).toBe("New description");
            });

            it("treats content starting with [ as JSON", () => {
                const jsonArrayContent = JSON.stringify([{ name: "test" }], null, 2);
                const result = updateYamlValue(jsonArrayContent, ["0", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toMatch(/^\s*\[/);
            });
        });

        describe("basic updates", () => {
            it("updates existing value in YAML", () => {
                const yamlContent = `openapi: 3.0.0
paths:
  /users:
    get:
      description: Old description
`;
                const result = updateYamlValue(
                    yamlContent,
                    ["paths", "/users", "get", "description"],
                    "New description"
                );

                expect(result.success).toBe(true);
                expect(result.content).toContain("description: New description");
                expect(result.content).not.toContain("Old description");
            });

            it("updates existing value in JSON", () => {
                const jsonContent = JSON.stringify(
                    {
                        paths: {
                            "/users": {
                                get: { description: "Old description" }
                            }
                        }
                    },
                    null,
                    2
                );

                const result = updateYamlValue(
                    jsonContent,
                    ["paths", "/users", "get", "description"],
                    "New description"
                );

                expect(result.success).toBe(true);
                const parsed = JSON.parse(result.content!);
                expect(parsed.paths["/users"].get.description).toBe("New description");
            });

            it("creates intermediate objects when createIntermediates=true (default)", () => {
                const yamlContent = `openapi: 3.0.0
`;
                const result = updateYamlValue(
                    yamlContent,
                    ["paths", "/users", "get", "description"],
                    "New endpoint description"
                );

                expect(result.success).toBe(true);
                expect(result.content).toContain("paths:");
                expect(result.content).toContain("/users:");
                expect(result.content).toContain("get:");
                expect(result.content).toContain("description: New endpoint description");
            });

            it("fails when path not found and createIntermediates=false", () => {
                const yamlContent = `openapi: 3.0.0
`;
                const result = updateYamlValue(
                    yamlContent,
                    ["paths", "/users", "get", "description"],
                    "New description",
                    false
                );

                expect(result.success).toBe(false);
                expect(result.error).toContain("Path not found");
            });
        });

        describe("edge cases", () => {
            it("returns error for empty path", () => {
                const yamlContent = `openapi: 3.0.0`;
                const result = updateYamlValue(yamlContent, [], "value");

                expect(result.success).toBe(false);
                expect(result.error).toContain("Empty path");
            });

            it("handles deeply nested paths", () => {
                const yamlContent = `openapi: 3.0.0
components:
  schemas:
    User:
      properties:
        address:
          properties:
            street:
              type: string
`;
                const result = updateYamlValue(
                    yamlContent,
                    ["components", "schemas", "User", "properties", "address", "properties", "street", "description"],
                    "Street name"
                );

                expect(result.success).toBe(true);
                const value = getYamlValue(result.content!, [
                    "components",
                    "schemas",
                    "User",
                    "properties",
                    "address",
                    "properties",
                    "street",
                    "description"
                ]);
                expect(value).toBe("Street name");
            });

            it("preserves YAML format after update", () => {
                const yamlContent = `# Comment at top
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
`;
                const result = updateYamlValue(yamlContent, ["info", "description"], "API description");

                expect(result.success).toBe(true);
                // Should still be YAML format (not JSON)
                expect(result.content).not.toMatch(/^\s*\{/);
                expect(result.content).toContain("openapi:");
            });

            it("preserves JSON format after update", () => {
                const jsonContent = JSON.stringify(
                    {
                        openapi: "3.0.0",
                        info: { title: "My API" }
                    },
                    null,
                    2
                );
                const result = updateYamlValue(jsonContent, ["info", "description"], "API description");

                expect(result.success).toBe(true);
                expect(result.content).toMatch(/^\s*\{/);
                // Should be valid JSON
                expect(() => JSON.parse(result.content!)).not.toThrow();
            });

            it("handles special characters in path keys", () => {
                const yamlContent = `paths:
  /users/{id}:
    get:
      operationId: getUser
`;
                const result = updateYamlValue(
                    yamlContent,
                    ["paths", "/users/{id}", "get", "description"],
                    "Get user by ID"
                );

                expect(result.success).toBe(true);
                const value = getYamlValue(result.content!, ["paths", "/users/{id}", "get", "description"]);
                expect(value).toBe("Get user by ID");
            });

            it("handles paths with dots in key names", () => {
                const yamlContent = `components:
  schemas:
    user.profile:
      type: object
`;
                const result = updateYamlValue(
                    yamlContent,
                    ["components", "schemas", "user.profile", "description"],
                    "User profile schema"
                );

                expect(result.success).toBe(true);
                const value = getYamlValue(result.content!, ["components", "schemas", "user.profile", "description"]);
                expect(value).toBe("User profile schema");
            });

            it("handles multiline description values", () => {
                const yamlContent = `info:
  title: Test API
`;
                const multilineDesc = "This is a long description.\nIt has multiple lines.\nAnd more content.";
                const result = updateYamlValue(yamlContent, ["info", "description"], multilineDesc);

                expect(result.success).toBe(true);
                const value = getYamlValue(result.content!, ["info", "description"]);
                expect(value).toBe(multilineDesc);
            });
        });

        describe("error handling", () => {
            it.each([
                [`{not valid json or yaml:::`, ["foo"], "bar", true],
                [`info:\n  title: string value here\n`, ["info", "title", "nested", "key"], "value", false],
                [`null`, ["foo"], "bar", true],
                [`- item1\n- item2`, ["foo", "bar"], "value", false]
            ])("returns error for invalid scenarios", (content, path, value, createIntermediates) => {
                const result = updateYamlValue(content, path, value, createIntermediates);
                expect(result.success).toBe(false);
            });
        });

        describe("x-enum-descriptions extension", () => {
            it("creates and updates x-enum-descriptions", () => {
                const enumYaml = `components:\n  schemas:\n    Status:\n      type: string\n      enum:\n        - ACTIVE\n        - INACTIVE\n`;
                const path = ["components", "schemas", "Status", "x-enum-descriptions", "ACTIVE"];

                // Create new
                const result = updateYamlValue(enumYaml, path, "User is currently active");
                expect(result.success).toBe(true);
                expect(getYamlValue(result.content!, path)).toBe("User is currently active");

                // Update existing
                const result2 = updateYamlValue(result.content!, path, "New description");
                expect(result2.success).toBe(true);
                expect(getYamlValue(result2.content!, path)).toBe("New description");
            });
        });
    });

    describe("getYamlValue", () => {
        const simpleYaml = `info:\n  title: My API\n`;
        const nestedYaml = `components:\n  schemas:\n    User:\n      properties:\n        name:\n          description: User name\n`;
        const arrayYaml = `paths:\n  /users:\n    get:\n      parameters:\n        - name: id\n          in: path\n        - name: limit\n          in: query\n`;

        it.each([
            [simpleYaml, ["info", "title"], "My API"],
            [nestedYaml, ["components", "schemas", "User", "properties", "name", "description"], "User name"],
            [simpleYaml, ["info", "description"], undefined],
            [`{{{not valid`, ["foo"], undefined],
            [simpleYaml, ["info", "title", "nested"], undefined],
            [arrayYaml, ["paths", "/users", "get", "parameters", "1", "name"], "limit"],
            [JSON.stringify({ info: { title: "My API", description: "Test" } }), ["info", "description"], "Test"]
        ])("getYamlValue returns expected value", (content, path, expected) => {
            expect(getYamlValue(content, path)).toEqual(expected);
        });

        it("handles empty path by returning root", () => {
            const value = getYamlValue(simpleYaml, []);
            expect(value).toEqual({ info: { title: "My API" } });
        });
    });

    describe("createOverrideContent", () => {
        it.each([
            [["paths", "/users", "get", "description"], "Get all users"],
            [["components", "schemas", "User", "description"], "User entity"],
            [["components", "schemas", "User", "properties", "name", "description"], "User name"],
            [["components", "schemas", "Status", "x-enum-descriptions", "ACTIVE"], "User is active"],
            [["paths", "/users/{id}", "get", "description"], "Get user by ID"],
            [["description"], "Top-level description"]
        ])("creates nested structure for path %j", (path, value) => {
            const result = createOverrideContent(path, value);
            expect(getYamlValue(result, path)).toBe(value);
        });

        it("handles empty path", () => {
            expect(createOverrideContent([], "Just a value").trim()).toBe("Just a value");
        });

        it("handles multiline description values", () => {
            const multilineDesc = "This is line 1.\nThis is line 2.\nThis is line 3.";
            const result = createOverrideContent(["info", "description"], multilineDesc);
            expect(getYamlValue(result, ["info", "description"])).toBe(multilineDesc);
        });

        it("produces valid YAML with correct structure", () => {
            const result = createOverrideContent(
                ["paths", "/users", "post", "requestBody", "description"],
                "Create a new user"
            );
            expect(getYamlValue(result, [])).toEqual({
                paths: { "/users": { post: { requestBody: { description: "Create a new user" } } } }
            });
        });

        it("creates object structure for numeric keys (always objects, never arrays)", () => {
            // createOverrideContent always creates objects because we can't infer
            // array vs object without existing structure. This is safe for OpenAPI
            // overrides which merge by path.
            const result = createOverrideContent(
                ["paths", "/users", "get", "parameters", "0", "description"],
                "User ID parameter"
            );
            const parsed = getYamlValue(result, []) as Record<string, unknown>;
            const params = (parsed.paths as Record<string, unknown>)["/users"] as Record<string, unknown>;
            const getOp = params.get as Record<string, unknown>;
            // parameters is an object with "0" as key, not an array
            expect(Array.isArray(getOp.parameters)).toBe(false);
            expect((getOp.parameters as Record<string, unknown>)["0"]).toEqual({ description: "User ID parameter" });
        });
    });

    describe("array handling", () => {
        describe("updateYamlValue with arrays", () => {
            it("updates value in existing array", () => {
                const content = `paths:
  /users:
    get:
      parameters:
        - name: id
          in: path
`;
                const result = updateYamlValue(
                    content,
                    ["paths", "/users", "get", "parameters", "0", "description"],
                    "User ID"
                );
                expect(result.success).toBe(true);
                const parsed = getYamlValue(result.content!, []) as Record<string, unknown>;
                const params = (parsed.paths as Record<string, unknown>)["/users"] as Record<string, unknown>;
                const getOp = params.get as Record<string, unknown>;
                const parameters = getOp.parameters as unknown[];
                expect(Array.isArray(parameters)).toBe(true);
                expect((parameters[0] as Record<string, unknown>).name).toBe("id"); // Preserved
                expect((parameters[0] as Record<string, unknown>).description).toBe("User ID"); // Added
            });

            it("creates object when path contains numeric index (no existing array)", () => {
                // When there's no existing structure, updateYamlValue creates objects
                // This is the safest approach since we can't infer array vs object
                const content = `openapi: 3.0.0
paths:
  /users:
    get:
      operationId: getUsers
`;
                const result = updateYamlValue(
                    content,
                    ["paths", "/users", "get", "parameters", "0", "description"],
                    "First parameter"
                );
                expect(result.success).toBe(true);
                const parsed = getYamlValue(result.content!, []) as Record<string, unknown>;
                const params = (parsed.paths as Record<string, unknown>)["/users"] as Record<string, unknown>;
                const getOp = params.get as Record<string, unknown>;
                // Creates object with "0" key, not array (safe default)
                expect(Array.isArray(getOp.parameters)).toBe(false);
                expect((getOp.parameters as Record<string, unknown>)["0"]).toEqual({ description: "First parameter" });
            });

            it("extends array when index is beyond current length", () => {
                const content = `paths:
  /users:
    get:
      parameters:
        - name: id
`;
                const result = updateYamlValue(
                    content,
                    ["paths", "/users", "get", "parameters", "2", "description"],
                    "Third parameter"
                );
                expect(result.success).toBe(true);
                const parsed = getYamlValue(result.content!, []) as Record<string, unknown>;
                const params = (parsed.paths as Record<string, unknown>)["/users"] as Record<string, unknown>;
                const getOp = params.get as Record<string, unknown>;
                const parameters = getOp.parameters as unknown[];
                expect(parameters.length).toBe(3);
                expect((parameters[2] as Record<string, unknown>).description).toBe("Third parameter");
            });
        });

        describe("createOverrideContent always creates objects", () => {
            it("creates object structure even for parameters path", () => {
                // createOverrideContent always creates objects since we can't infer
                // array vs object structure without existing data
                const result = createOverrideContent(
                    ["paths", "/plant", "get", "parameters", "0", "description"],
                    "Plant ID"
                );
                // Produces object structure (safe for override merging):
                // paths:
                //   /plant:
                //     get:
                //       parameters:
                //         "0":
                //           description: Plant ID
                const parsed = getYamlValue(result, []) as Record<string, unknown>;
                expect(parsed).toEqual({
                    paths: {
                        "/plant": {
                            get: {
                                parameters: {
                                    "0": { description: "Plant ID" }
                                }
                            }
                        }
                    }
                });
            });

            it("creates object structure for security path", () => {
                // Always creates objects - no special handling for "security"
                const result = createOverrideContent(["security", "0", "oauth2"], "read:users");
                const parsed = getYamlValue(result, []) as Record<string, unknown>;
                // security is an object with "0" key, not an array
                expect(Array.isArray(parsed.security)).toBe(false);
                const securityObj = parsed.security as Record<string, unknown>;
                expect(securityObj["0"]).toEqual({ oauth2: "read:users" });
            });

            it("treats HTTP status codes as object keys, not array indices", () => {
                // responses.200, responses.404, etc. should be objects, not arrays
                const result = createOverrideContent(
                    ["paths", "/users", "get", "responses", "200", "description"],
                    "Success response"
                );
                const parsed = getYamlValue(result, []) as Record<string, unknown>;
                expect(parsed).toEqual({
                    paths: {
                        "/users": {
                            get: {
                                responses: {
                                    "200": { description: "Success response" }
                                }
                            }
                        }
                    }
                });
                // Verify it's NOT an array
                const responses = (
                    ((parsed.paths as Record<string, unknown>)["/users"] as Record<string, unknown>).get as Record<
                        string,
                        unknown
                    >
                ).responses;
                expect(Array.isArray(responses)).toBe(false);
            });

            it("treats large numeric keys as object keys", () => {
                // Any number >= 100 should be treated as an object key
                const result = createOverrideContent(["data", "404", "message"], "Not found");
                const parsed = getYamlValue(result, []) as Record<string, unknown>;
                expect(parsed).toEqual({
                    data: {
                        "404": { message: "Not found" }
                    }
                });
            });
        });
    });

    describe("generators.yml updates", () => {
        const singleSpecYml = `api:\n  specs:\n    - openapi: ./openapi/openapi.yaml\n`;
        const withOverridesYml = `api:\n  specs:\n    - openapi: ./openapi/openapi.yaml\n      overrides: ./openapi/old-overrides.yaml\n`;
        const multiSpecYml = `api:\n  specs:\n    - openapi: ./openapi/api1.yaml\n    - openapi: ./openapi/api2.yaml\n`;

        it("adds or updates overrides field", () => {
            const result = updateYamlValue(
                singleSpecYml,
                ["api", "specs", "0", "overrides"],
                "./openapi/openapi-overrides.yaml"
            );
            expect(result.success).toBe(true);
            expect(getYamlValue(result.content!, ["api", "specs", "0", "overrides"])).toBe(
                "./openapi/openapi-overrides.yaml"
            );

            const result2 = updateYamlValue(
                withOverridesYml,
                ["api", "specs", "0", "overrides"],
                "./openapi/new-overrides.yaml"
            );
            expect(result2.success).toBe(true);
            expect(getYamlValue(result2.content!, ["api", "specs", "0", "overrides"])).toBe(
                "./openapi/new-overrides.yaml"
            );
        });

        it("handles multiple spec entries", () => {
            const result = updateYamlValue(
                multiSpecYml,
                ["api", "specs", "1", "overrides"],
                "./openapi/api2-overrides.yaml"
            );
            expect(result.success).toBe(true);
            expect(getYamlValue(result.content!, ["api", "specs", "0", "overrides"])).toBeUndefined();
            expect(getYamlValue(result.content!, ["api", "specs", "1", "overrides"])).toBe(
                "./openapi/api2-overrides.yaml"
            );
        });

        it("preserves other content", () => {
            const fullYml = `default-group: local\napi:\n  specs:\n    - openapi: ./openapi/openapi.yaml\ngroups:\n  local:\n    generators:\n      - name: fernapi/fern-typescript-sdk\n`;
            const result = updateYamlValue(
                fullYml,
                ["api", "specs", "0", "overrides"],
                "./openapi/openapi-overrides.yaml"
            );
            expect(result.success).toBe(true);
            expect(getYamlValue(result.content!, ["api", "specs", "0", "overrides"])).toBe(
                "./openapi/openapi-overrides.yaml"
            );
            expect(getYamlValue(result.content!, ["default-group"])).toBe("local");
            expect(getYamlValue(result.content!, ["groups", "local", "generators", "0", "name"])).toBe(
                "fernapi/fern-typescript-sdk"
            );
        });
    });

    describe("createParameterOverrideContent", () => {
        it("creates parameter override with name and in fields", () => {
            const jsonPath = ["paths", "/plant/search/status", "get", "parameters", "0", "description"];
            const description = "The status of plants to search for.";
            const paramDetails = { name: "status", in: "query" };

            const result = createParameterOverrideContent(jsonPath, description, paramDetails);
            const parsed = getYamlValue(result, []) as Record<string, unknown>;

            expect(parsed).toEqual({
                paths: {
                    "/plant/search/status": {
                        get: {
                            parameters: [
                                {
                                    name: "status",
                                    in: "query",
                                    description: "The status of plants to search for."
                                }
                            ]
                        }
                    }
                }
            });
        });

        it("creates parameter override for path parameter", () => {
            const jsonPath = ["paths", "/plant/{id}", "get", "parameters", "0", "description"];
            const description = "The ID of the plant";
            const paramDetails = { name: "id", in: "path" };

            const result = createParameterOverrideContent(jsonPath, description, paramDetails);
            const parsed = getYamlValue(result, []) as Record<string, unknown>;

            expect(parsed).toEqual({
                paths: {
                    "/plant/{id}": {
                        get: {
                            parameters: [
                                {
                                    name: "id",
                                    in: "path",
                                    description: "The ID of the plant"
                                }
                            ]
                        }
                    }
                }
            });
        });

        it("creates parameter override for header parameter", () => {
            const jsonPath = ["paths", "/plant", "post", "parameters", "0", "description"];
            const description = "API key for authentication";
            const paramDetails = { name: "X-API-Key", in: "header" };

            const result = createParameterOverrideContent(jsonPath, description, paramDetails);
            const parsed = getYamlValue(result, []) as Record<string, unknown>;

            expect(parsed).toEqual({
                paths: {
                    "/plant": {
                        post: {
                            parameters: [
                                {
                                    name: "X-API-Key",
                                    in: "header",
                                    description: "API key for authentication"
                                }
                            ]
                        }
                    }
                }
            });
        });

        it("falls back to createOverrideContent if parameters not in path", () => {
            // If the path doesn't contain "parameters", fall back to regular override
            const jsonPath = ["paths", "/plant", "get", "description"];
            const description = "Get plant endpoint";
            const paramDetails = { name: "status", in: "query" };

            const result = createParameterOverrideContent(jsonPath, description, paramDetails);
            const parsed = getYamlValue(result, []) as Record<string, unknown>;

            // Should create regular override structure (not parameter array)
            expect(parsed).toEqual({
                paths: {
                    "/plant": {
                        get: {
                            description: "Get plant endpoint"
                        }
                    }
                }
            });
        });

        it("handles path-level parameters", () => {
            const jsonPath = ["paths", "/plant/{id}", "parameters", "0", "description"];
            const description = "Plant ID parameter";
            const paramDetails = { name: "id", in: "path" };

            const result = createParameterOverrideContent(jsonPath, description, paramDetails);
            const parsed = getYamlValue(result, []) as Record<string, unknown>;

            expect(parsed).toEqual({
                paths: {
                    "/plant/{id}": {
                        parameters: [
                            {
                                name: "id",
                                in: "path",
                                description: "Plant ID parameter"
                            }
                        ]
                    }
                }
            });
        });
    });

    describe("JSON format support", () => {
        describe("createOverrideContent with JSON format", () => {
            it("creates JSON override content for simple path", () => {
                const result = createOverrideContent(
                    ["paths", "/users", "get", "description"],
                    "Get all users",
                    "json"
                );

                // Should be valid JSON
                const parsed = JSON.parse(result);
                expect(parsed).toEqual({
                    paths: {
                        "/users": {
                            get: {
                                description: "Get all users"
                            }
                        }
                    }
                });
            });

            it("creates JSON override content for nested component path", () => {
                const result = createOverrideContent(
                    ["components", "schemas", "User", "properties", "name", "description"],
                    "The user's display name",
                    "json"
                );

                const parsed = JSON.parse(result);
                expect(parsed).toEqual({
                    components: {
                        schemas: {
                            User: {
                                properties: {
                                    name: {
                                        description: "The user's display name"
                                    }
                                }
                            }
                        }
                    }
                });
            });

            it("handles empty path with JSON format", () => {
                const result = createOverrideContent([], "Just a value", "json");
                expect(JSON.parse(result)).toBe("Just a value");
            });

            it("creates properly formatted JSON with indentation", () => {
                const result = createOverrideContent(["info", "description"], "API description", "json");
                // Should have proper indentation (2 spaces)
                expect(result).toContain("  ");
                expect(result).toMatch(/{\n\s+"info"/);
            });
        });

        describe("createParameterOverrideContent with JSON format", () => {
            it("creates JSON parameter override with name and in fields", () => {
                const jsonPath = ["paths", "/plant/search", "get", "parameters", "0", "description"];
                const description = "Search query parameter";
                const paramDetails = { name: "q", in: "query" };

                const result = createParameterOverrideContent(jsonPath, description, paramDetails, "json");

                // Should be valid JSON
                const parsed = JSON.parse(result);
                expect(parsed).toEqual({
                    paths: {
                        "/plant/search": {
                            get: {
                                parameters: [
                                    {
                                        name: "q",
                                        in: "query",
                                        description: "Search query parameter"
                                    }
                                ]
                            }
                        }
                    }
                });
            });

            it("creates JSON parameter override for path parameter", () => {
                const jsonPath = ["paths", "/users/{id}", "get", "parameters", "0", "description"];
                const description = "User ID";
                const paramDetails = { name: "id", in: "path" };

                const result = createParameterOverrideContent(jsonPath, description, paramDetails, "json");

                const parsed = JSON.parse(result);
                expect(parsed.paths["/users/{id}"].get.parameters[0]).toEqual({
                    name: "id",
                    in: "path",
                    description: "User ID"
                });
            });

            it("falls back to JSON createOverrideContent if parameters not in path", () => {
                const jsonPath = ["paths", "/plant", "get", "description"];
                const description = "Get plant endpoint";
                const paramDetails = { name: "status", in: "query" };

                const result = createParameterOverrideContent(jsonPath, description, paramDetails, "json");

                const parsed = JSON.parse(result);
                expect(parsed).toEqual({
                    paths: {
                        "/plant": {
                            get: {
                                description: "Get plant endpoint"
                            }
                        }
                    }
                });
            });
        });

        describe("format defaults to yaml", () => {
            it("createOverrideContent defaults to YAML", () => {
                const result = createOverrideContent(["info", "title"], "My API");
                // YAML doesn't start with {
                expect(result.trim().startsWith("{")).toBe(false);
                expect(result).toContain("info:");
            });

            it("createParameterOverrideContent defaults to YAML", () => {
                const result = createParameterOverrideContent(
                    ["paths", "/test", "get", "parameters", "0", "description"],
                    "Test param",
                    { name: "test", in: "query" }
                );
                // YAML doesn't start with {
                expect(result.trim().startsWith("{")).toBe(false);
                expect(result).toContain("paths:");
            });
        });
    });
});
