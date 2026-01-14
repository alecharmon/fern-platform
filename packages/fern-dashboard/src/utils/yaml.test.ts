import { describe, expect, it } from "vitest";

import {
    getYamlValue,
    isYamlContent,
    parseYaml,
    parseYamlToJs,
    stringifyYaml,
    updateYamlValue,
    YAML_SCHEMAS
} from "./yaml";

describe("yaml utilities", () => {
    describe("isYamlContent", () => {
        it("returns false for JSON object content", () => {
            expect(isYamlContent('{ "key": "value" }')).toBe(false);
        });

        it("returns false for JSON array content", () => {
            expect(isYamlContent('[ "item1", "item2" ]')).toBe(false);
        });

        it("returns true for YAML content", () => {
            expect(isYamlContent("key: value")).toBe(true);
            expect(isYamlContent("openapi: 3.0.0\ninfo:\n  title: API")).toBe(true);
        });

        it("handles whitespace correctly", () => {
            expect(isYamlContent("  { }")).toBe(false);
            expect(isYamlContent("  key: value")).toBe(true);
        });
    });

    describe("parseYaml", () => {
        it("parses YAML and returns both data and document", () => {
            const yaml = "key: value\nnested:\n  foo: bar";
            const result = parseYaml(yaml);

            expect(result.data).toEqual({ key: "value", nested: { foo: "bar" } });
            expect(result.doc).toBeDefined();
        });
    });

    describe("parseYamlToJs", () => {
        it("parses YAML content", () => {
            const yaml = "openapi: 3.0.0\ninfo:\n  title: Test API";
            const result = parseYamlToJs<{ openapi: string; info: { title: string } }>(yaml);

            expect(result.openapi).toBe("3.0.0");
            expect(result.info.title).toBe("Test API");
        });

        it("parses JSON content", () => {
            const json = '{ "openapi": "3.0.0", "info": { "title": "Test API" } }';
            const result = parseYamlToJs<{ openapi: string; info: { title: string } }>(json);

            expect(result.openapi).toBe("3.0.0");
            expect(result.info.title).toBe("Test API");
        });
    });

    describe("getYamlValue", () => {
        it("gets nested value from YAML", () => {
            const yaml = "openapi: 3.0.0\ninfo:\n  title: Test API\n  version: 1.0.0";

            expect(getYamlValue(yaml, ["info", "title"])).toBe("Test API");
            expect(getYamlValue(yaml, ["info", "version"])).toBe("1.0.0");
            expect(getYamlValue(yaml, ["openapi"])).toBe("3.0.0");
        });

        it("returns undefined for non-existent paths", () => {
            const yaml = "info:\n  title: Test";

            expect(getYamlValue(yaml, ["info", "description"])).toBeUndefined();
            expect(getYamlValue(yaml, ["nonexistent"])).toBeUndefined();
        });

        it("handles array access", () => {
            const yaml = "items:\n  - name: first\n  - name: second";

            expect(getYamlValue(yaml, ["items", "0", "name"])).toBe("first");
            expect(getYamlValue(yaml, ["items", "1", "name"])).toBe("second");
        });
    });

    describe("updateYamlValue", () => {
        describe("basic updates", () => {
            it("updates existing value", () => {
                const yaml = "info:\n  title: Old Title\n  version: 1.0.0";
                const result = updateYamlValue(yaml, ["info", "title"], "New Title");

                expect(result.success).toBe(true);
                expect(result.content).toContain("New Title");
                expect(getYamlValue(result.content!, ["info", "title"])).toBe("New Title");
                // version should still be there
                expect(getYamlValue(result.content!, ["info", "version"])).toBe("1.0.0");
            });

            it("creates intermediate objects when needed", () => {
                const yaml = "openapi: 3.0.0";
                const result = updateYamlValue(yaml, ["info", "description"], "API description");

                expect(result.success).toBe(true);
                expect(getYamlValue(result.content!, ["info", "description"])).toBe("API description");
            });

            it("fails with empty path", () => {
                const yaml = "key: value";
                const result = updateYamlValue(yaml, [], "new value");

                expect(result.success).toBe(false);
                expect(result.error).toContain("Empty path");
            });
        });

        describe("comment preservation", () => {
            it("preserves top-level comments", () => {
                const yaml = `# This is a top-level comment
openapi: 3.0.0
info:
  title: Test API
`;
                const result = updateYamlValue(yaml, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toContain("# This is a top-level comment");
            });

            it("preserves inline comments", () => {
                const yaml = `openapi: 3.0.0 # OpenAPI version
info:
  title: Test API # The API title
  version: 1.0.0
`;
                const result = updateYamlValue(yaml, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toContain("# OpenAPI version");
                expect(result.content).toContain("# The API title");
            });

            it("preserves comments in nested structures", () => {
                const yaml = `openapi: 3.0.0
# Info section
info:
  title: Test API
  # Version comment
  version: 1.0.0
`;
                const result = updateYamlValue(yaml, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toContain("# Info section");
                expect(result.content).toContain("# Version comment");
            });

            it("preserves comments when updating existing values", () => {
                const yaml = `openapi: 3.0.0
info:
  title: Old Title # Title comment
  version: 1.0.0
`;
                const result = updateYamlValue(yaml, ["info", "title"], "New Title");

                expect(result.success).toBe(true);
                expect(result.content).toContain("# Title comment");
                expect(getYamlValue(result.content!, ["info", "title"])).toBe("New Title");
            });

            it("preserves comments after multiple updates", () => {
                const yaml = `# Main comment
openapi: 3.0.0
info:
  title: Test # title comment
  version: 1.0.0 # version comment
`;
                let content = yaml;

                // First update
                const result1 = updateYamlValue(content, ["info", "description"], "Description 1");
                expect(result1.success).toBe(true);
                content = result1.content!;

                // Second update
                const result2 = updateYamlValue(content, ["info", "description"], "Description 2");
                expect(result2.success).toBe(true);
                content = result2.content!;

                expect(content).toContain("# Main comment");
                expect(content).toContain("# title comment");
                expect(content).toContain("# version comment");
            });

            it("preserves block comments", () => {
                const yaml = `openapi: 3.0.0
# This is a block comment
# that spans multiple lines
# and provides important info
info:
  title: Test API
`;
                const result = updateYamlValue(yaml, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                expect(result.content).toContain("# This is a block comment");
                expect(result.content).toContain("# that spans multiple lines");
                expect(result.content).toContain("# and provides important info");
            });
        });

        describe("JSON content handling", () => {
            it("handles JSON content correctly", () => {
                const json = JSON.stringify({ info: { title: "Test" } }, null, 2);
                const result = updateYamlValue(json, ["info", "description"], "New description");

                expect(result.success).toBe(true);
                const parsed = JSON.parse(result.content!);
                expect(parsed.info.description).toBe("New description");
            });

            it("preserves JSON format after update", () => {
                const json = JSON.stringify({ openapi: "3.0.0" }, null, 2);
                const result = updateYamlValue(json, ["info", "title"], "Test");

                expect(result.success).toBe(true);
                expect(result.content).toMatch(/^\s*\{/);
                expect(() => JSON.parse(result.content!)).not.toThrow();
            });
        });

        describe("array handling", () => {
            it("updates value in existing array", () => {
                const yaml = `paths:
  /users:
    get:
      parameters:
        - name: id
          in: path
`;
                const result = updateYamlValue(
                    yaml,
                    ["paths", "/users", "get", "parameters", "0", "description"],
                    "User ID parameter"
                );

                expect(result.success).toBe(true);
                expect(
                    getYamlValue(result.content!, ["paths", "/users", "get", "parameters", "0", "description"])
                ).toBe("User ID parameter");
                // Original values should be preserved
                expect(getYamlValue(result.content!, ["paths", "/users", "get", "parameters", "0", "name"])).toBe("id");
            });
        });
    });

    describe("stringifyYaml", () => {
        it("stringifies object to YAML", () => {
            const data = { info: { title: "Test API", version: "1.0.0" } };
            const result = stringifyYaml(data);

            expect(result).toContain("info:");
            expect(result).toContain("title: Test API");
            expect(result).toContain("version: 1.0.0");
        });

        it("adds schema comment when schemaUrl provided", () => {
            const data = { info: { title: "Test" } };
            const result = stringifyYaml(data, { schemaUrl: YAML_SCHEMAS.DOCS_YML });

            expect(result).toContain("# yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json");
        });

        it("does not add schema comment when schemaUrl not provided", () => {
            const data = { info: { title: "Test" } };
            const result = stringifyYaml(data);

            expect(result).not.toContain("# yaml-language-server");
        });

        it("handles nested structures", () => {
            const data = {
                openapi: "3.0.0",
                paths: {
                    "/users": {
                        get: { operationId: "getUsers" }
                    }
                }
            };
            const result = stringifyYaml(data);

            expect(result).toContain("openapi: 3.0.0");
            expect(result).toContain("/users:");
            expect(result).toContain("get:");
            expect(result).toContain("operationId: getUsers");
        });
    });

    describe("YAML_SCHEMAS", () => {
        it("has correct docs.yml schema URL", () => {
            expect(YAML_SCHEMAS.DOCS_YML).toBe("https://schema.buildwithfern.dev/docs-yml.json");
        });

        it("has correct generators.yml schema URL", () => {
            expect(YAML_SCHEMAS.GENERATORS_YML).toBe("https://schema.buildwithfern.dev/generators-yml.json");
        });
    });
});
