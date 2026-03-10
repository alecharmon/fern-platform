import { describe, expect, it } from "vitest";

import { extractDescription, extractRawUrl, generateOperationId, parseUrl, resolveVariables } from "../utils.js";

describe("extractDescription", () => {
    it("returns undefined for null/undefined", () => {
        expect(extractDescription(undefined)).toBeUndefined();
        expect(extractDescription(null)).toBeUndefined();
    });

    it("returns string directly", () => {
        expect(extractDescription("A description")).toBe("A description");
    });

    it("returns undefined for empty string", () => {
        expect(extractDescription("")).toBeUndefined();
    });

    it("extracts content from object", () => {
        expect(extractDescription({ content: "Object description" })).toBe("Object description");
    });

    it("returns undefined for empty object content", () => {
        expect(extractDescription({ content: "" })).toBeUndefined();
    });
});

describe("resolveVariables", () => {
    it("replaces known variables with values", () => {
        const result = resolveVariables("{{baseUrl}}/users", [{ key: "baseUrl", value: "https://api.example.com" }]);
        expect(result).toBe("https://api.example.com/users");
    });

    it("converts remaining {{var}} to {var} for OpenAPI", () => {
        const result = resolveVariables("{{baseUrl}}/users/{{userId}}");
        expect(result).toBe("{baseUrl}/users/{userId}");
    });

    it("handles mixed resolved and unresolved variables", () => {
        const result = resolveVariables("{{baseUrl}}/users/{{userId}}", [
            { key: "baseUrl", value: "https://api.example.com" }
        ]);
        expect(result).toBe("https://api.example.com/users/{userId}");
    });

    it("handles no variables", () => {
        const result = resolveVariables("https://api.example.com/users");
        expect(result).toBe("https://api.example.com/users");
    });
});

describe("extractRawUrl", () => {
    it("returns empty string for undefined", () => {
        expect(extractRawUrl(undefined)).toBe("");
    });

    it("returns string directly", () => {
        expect(extractRawUrl("https://api.example.com")).toBe("https://api.example.com");
    });

    it("returns raw URL from object", () => {
        expect(extractRawUrl({ raw: "https://api.example.com/test" })).toBe("https://api.example.com/test");
    });

    it("reconstructs URL from parts", () => {
        const result = extractRawUrl({
            protocol: "https",
            host: ["api", "example", "com"],
            path: ["users", "123"]
        });
        expect(result).toBe("https://api.example.com/users/123");
    });

    it("handles host as string", () => {
        const result = extractRawUrl({
            protocol: "https",
            host: "api.example.com",
            path: ["users"]
        });
        expect(result).toBe("https://api.example.com/users");
    });

    it("handles port", () => {
        const result = extractRawUrl({
            protocol: "http",
            host: ["localhost"],
            port: "3000",
            path: ["api"]
        });
        expect(result).toBe("http://localhost:3000/api");
    });
});

describe("parseUrl", () => {
    it("parses a full URL", () => {
        const result = parseUrl("https://api.example.com/users/123");
        expect(result.baseUrl).toBe("https://api.example.com");
        expect(result.path).toBe("/users/123");
    });

    it("handles path-only URLs", () => {
        const result = parseUrl("/users/123");
        expect(result.baseUrl).toBe("");
        expect(result.path).toBe("/users/123");
    });

    it("converts :param to {param}", () => {
        const result = parseUrl("https://api.example.com/users/:userId/posts/:postId");
        expect(result.path).toBe("/users/{userId}/posts/{postId}");
    });

    it("resolves variables in URL", () => {
        const result = parseUrl("{{baseUrl}}/users", [{ key: "baseUrl", value: "https://api.example.com" }]);
        expect(result.baseUrl).toBe("https://api.example.com");
        expect(result.path).toBe("/users");
    });
});

describe("generateOperationId", () => {
    it("generates ID from method and path", () => {
        expect(generateOperationId("GET", "/users")).toBe("getUsers");
    });

    it("handles path parameters", () => {
        expect(generateOperationId("GET", "/users/{userId}")).toBe("getUsersUserid");
    });

    it("handles nested paths", () => {
        expect(generateOperationId("POST", "/users/{userId}/posts")).toBe("postUsersUseridPosts");
    });

    it("handles root path", () => {
        expect(generateOperationId("GET", "/")).toBe("get");
    });
});
