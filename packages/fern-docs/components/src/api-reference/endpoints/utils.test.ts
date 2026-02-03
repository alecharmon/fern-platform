import type { EndpointDefinition, Environment } from "@fern-api/fdr-sdk/api-definition";
import { EndpointId, EnvironmentId } from "@fern-api/fdr-sdk/api-definition";
import { describe, expect, it } from "vitest";
import { resolveEnvironmentUrlInCodeSnippet } from "./utils";

describe("resolveEnvironmentUrlInCodeSnippet", () => {
    const createEndpoint = (environments: Array<{ id: string; baseUrl: string }>): EndpointDefinition =>
        ({
            id: EndpointId("test-endpoint"),
            method: "GET",
            path: [],
            environments: environments.map((env) => ({
                id: EnvironmentId(env.id),
                baseUrl: env.baseUrl
            })) as Environment[],
            defaultEnvironment: environments[0] ? EnvironmentId(environments[0].id) : undefined,
            isResponseStream: false,
            errorsV2: []
        }) as unknown as EndpointDefinition;

    describe("exact URL match", () => {
        it("replaces environment URL with user-set baseUrl", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X GET "https://api.example.com/v1/users"';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://api.custom.com/v1/users"');
        });

        it("replaces all occurrences of the URL", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X GET "https://api.example.com/users" # https://api.example.com';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://api.custom.com/users" # https://api.custom.com');
        });
    });

    describe("sanitized URL match (case-insensitive)", () => {
        it("replaces sanitized environment URL when exact match not found", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://YOUR_SPACE.example.com" }]);
            const snippet = 'curl -X GET "https://your_space.example.com/v1/users"';
            const baseUrl = "https://my_space.example.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://my_space.example.com/v1/users"');
        });

        it("prefers exact match over sanitized match", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://API.example.com" }]);
            // Snippet has exact match
            const snippet = 'curl -X GET "https://API.example.com/v1/users"';
            const baseUrl = "https://custom.example.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://custom.example.com/v1/users"');
        });
    });

    describe("multiple environments", () => {
        it("finds the correct environment URL to replace", () => {
            const endpoint = createEndpoint([
                { id: "Dev", baseUrl: "https://api.dev.example.com" },
                { id: "Staging", baseUrl: "https://api.staging.example.com" },
                { id: "Production", baseUrl: "https://api.example.com" }
            ]);
            const snippet = 'curl -X GET "https://api.staging.example.com/v1/users"';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://api.custom.com/v1/users"');
        });

        it("finds sanitized version when multiple environments exist", () => {
            const endpoint = createEndpoint([
                { id: "Dev", baseUrl: "https://DEV.example.com" },
                { id: "Production", baseUrl: "https://PROD.example.com" }
            ]);
            const snippet = 'curl -X GET "https://prod.example.com/v1/users"';
            const baseUrl = "https://custom.example.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://custom.example.com/v1/users"');
        });
    });

    describe("trailing slash handling", () => {
        it("removes trailing slash from baseUrl before replacement", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X GET "https://api.example.com/v1/users"';
            const baseUrl = "https://api.custom.com/"; // Has trailing slash

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://api.custom.com/v1/users"');
        });

        it("handles environment URL with trailing slash", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com/" }]);
            const snippet = 'curl -X GET "https://api.example.com/v1/users"';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://api.custom.com/v1/users"');
        });
    });

    describe("no replacement scenarios", () => {
        it("returns original snippet when no environment URL found", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X GET "https://api.different.com/v1/users"';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe(snippet);
        });

        it("returns original snippet when baseUrl is undefined", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X GET "https://api.example.com/v1/users"';
            const baseUrl = undefined;

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe(snippet);
        });

        it("returns original snippet when no environments defined", () => {
            const endpoint = createEndpoint([]);
            const snippet = 'curl -X GET "https://api.example.com/v1/users"';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe(snippet);
        });

        it("returns original snippet when URL matches baseUrl (no change needed)", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X GET "https://api.example.com/v1/users"';
            const baseUrl = "https://api.example.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe(snippet);
        });
    });

    describe("complex snippets", () => {
        it("handles Python requests snippet", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'response = requests.post("https://api.example.com/v1/users", headers=headers)';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('response = requests.post("https://api.custom.com/v1/users", headers=headers)');
        });

        it("handles TypeScript fetch snippet", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'const response = await fetch("https://api.example.com/v1/users", { method: "GET" });';
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('const response = await fetch("https://api.custom.com/v1/users", { method: "GET" });');
        });

        it("preserves query parameters and path", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com/api/v1" }]);
            const snippet = 'curl -X GET "https://api.example.com/api/v1/users?page=1&limit=10"';
            const baseUrl = "https://custom.com/api/v1";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://custom.com/api/v1/users?page=1&limit=10"');
        });
    });

    describe("edge cases", () => {
        it("handles empty snippet", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = "";
            const baseUrl = "https://api.custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe("");
        });

        it("handles snippet with special characters in URL", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com" }]);
            const snippet = 'curl -X POST "https://api.example.com/test/hello%40example"';
            const baseUrl = "https://custom.com";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X POST "https://custom.com/test/hello%40example"');
        });

        it("handles environment with basepath", () => {
            const endpoint = createEndpoint([{ id: "Production", baseUrl: "https://api.example.com/api/v2" }]);
            const snippet = 'curl -X GET "https://api.example.com/api/v2/users"';
            const baseUrl = "https://custom.com/api/v2";

            const result = resolveEnvironmentUrlInCodeSnippet(endpoint, snippet, baseUrl);

            expect(result).toBe('curl -X GET "https://custom.com/api/v2/users"');
        });
    });
});
