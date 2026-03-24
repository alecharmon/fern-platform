import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSessionOrThrow: vi.fn().mockResolvedValue({
        user: { sub: "auth0|test-user" },
        accessToken: "test-token"
    })
}));

const mockFetch = vi.fn() as Mock<typeof fetch>;
global.fetch = mockFetch;

describe("bootstrap-docs-repo API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("POST /api/bootstrap-docs-repo", () => {
        it("should generate zip with valid JSON OpenAPI spec", async () => {
            const mockOpenapiSpec = {
                openapi: "3.0.0",
                info: { title: "Test API", version: "1.0.0" },
                paths: {}
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers([["content-type", "application/json"]]),
                text: async () => JSON.stringify(mockOpenapiSpec)
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe("application/zip");
            expect(response.headers.get("content-disposition")).toBe('attachment; filename="testorg-docs.zip"');

            const buffer = await response.arrayBuffer();
            expect(buffer.byteLength).toBeGreaterThan(0);
        });

        it("should generate zip with YAML OpenAPI spec", async () => {
            const mockYamlSpec = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}`;

            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers([["content-type", "application/yaml"]]),
                text: async () => mockYamlSpec
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.yaml",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("content-type")).toBe("application/zip");
        });

        it("should include marketing site in docs.yml when provided", async () => {
            const mockOpenapiSpec = { openapi: "3.0.0", info: { title: "Test", version: "1.0.0" }, paths: {} };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers([["content-type", "application/json"]]),
                text: async () => JSON.stringify(mockOpenapiSpec)
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: "testorg",
                    marketingSite: "https://example.com"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it("should return 400 for invalid request body", async () => {
            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it("should return 400 for invalid URL", async () => {
            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "not-a-url",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it("should return 500 when OpenAPI fetch fails", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: "Not Found"
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(500);
            const json = await response.json();
            expect(json.error).toBe("Failed to bootstrap docs repo");
        });

        it("should handle JSON content with .yaml URL extension", async () => {
            const mockOpenapiSpec = { openapi: "3.0.0", info: { title: "Test", version: "1.0.0" }, paths: {} };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers([["content-type", "application/json"]]),
                text: async () => JSON.stringify(mockOpenapiSpec)
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.yaml",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it("should handle YAML content with .json URL extension", async () => {
            const mockYamlSpec = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}`;

            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers([["content-type", "text/yaml"]]),
                text: async () => mockYamlSpec
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it("should validate organizationName is not empty", async () => {
            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: ""
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it("should validate marketingSite is a valid URL when provided", async () => {
            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: "testorg",
                    marketingSite: "not-a-url"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(400);
        });

        it("should return 401 when not authenticated", async () => {
            const { getCurrentSessionOrThrow } = await import("@/app/services/auth0/getCurrentSession");
            vi.mocked(getCurrentSessionOrThrow).mockRejectedValueOnce(new Error("Not authenticated"));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                headers: new Headers([["content-type", "application/json"]]),
                text: async () => JSON.stringify({ openapi: "3.0.0" })
            } as Response);

            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "https://example.com/openapi.json",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(401);
            const json = await response.json();
            expect(json.error).toBe("Authentication required");
        });

        it("should reject non-HTTP(S) protocol URLs", async () => {
            const request = new NextRequest("http://localhost:3000/api/bootstrap-docs-repo", {
                method: "POST",
                body: JSON.stringify({
                    openapiUrl: "ftp://example.com/openapi.json",
                    organizationName: "testorg"
                })
            });

            const response = await POST(request);

            expect(response.status).toBe(500);
            const json = await response.json();
            expect(json.message).toBe("Only HTTP(S) URLs are allowed");
        });
    });
});
