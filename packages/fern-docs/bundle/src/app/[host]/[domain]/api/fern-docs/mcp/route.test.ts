import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@fern-api/docs-loader", () => ({
    getMetadata: vi.fn(
        () => () =>
            Promise.resolve({
                org: "test-org"
            })
    )
}));

vi.mock("@fern-api/docs-server/auth/getAuthStateEdge", () => ({
    createGetAuthStateEdge: vi.fn(() =>
        Promise.resolve({
            getAuthState: vi.fn(() => Promise.resolve({ ok: true }))
        })
    )
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
    McpServer: vi.fn().mockImplementation(() => ({
        tool: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined)
    }))
}));

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => ({
    WebStandardStreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
        handleRequest: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ result: "success" }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            })
        )
    }))
}));

describe("MCP Server Route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET /_mcp/server", () => {
        it("should return 200 for authenticated requests with JSON-RPC params", async () => {
            const request = new NextRequest("http://docs.ada.cx/_mcp/server?method=initialize", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const params = Promise.resolve({
                host: "docs.ada.cx",
                domain: "docs.ada.cx",
                lang: "en"
            });

            const response = await GET(request, { params });

            expect(response.status).toBe(200);
        });

        it("should return 200 for authenticated requests with Accept: application/json", async () => {
            const request = new NextRequest("http://docs.ada.cx/_mcp/server", {
                method: "GET",
                headers: {
                    Accept: "application/json"
                }
            });

            const params = Promise.resolve({
                host: "docs.ada.cx",
                domain: "docs.ada.cx",
                lang: "en"
            });

            const response = await GET(request, { params });

            expect(response.status).toBe(200);
        });

        it("should return 200 with plain text for non-JSON requests", async () => {
            const request = new NextRequest("http://docs.ada.cx/_mcp/server", {
                method: "GET"
            });

            const params = Promise.resolve({
                host: "docs.ada.cx",
                domain: "docs.ada.cx",
                lang: "en"
            });

            const response = await GET(request, { params });

            expect(response.status).toBe(200);
            expect(response.headers.get("Content-Type")).toBe("text/plain");
            const text = await response.text();
            expect(text).toContain("mcp server");
        });
    });

    describe("POST /_mcp/server", () => {
        it("should return 200 for authenticated POST requests", async () => {
            const request = new NextRequest("http://docs.ada.cx/_mcp/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "initialize",
                    params: {},
                    id: 1
                })
            });

            const params = Promise.resolve({
                host: "docs.ada.cx",
                domain: "docs.ada.cx",
                lang: "en"
            });

            const response = await POST(request, { params });

            expect(response.status).toBe(200);
        });

        it("should not return 404", async () => {
            const request = new NextRequest("http://docs.ada.cx/_mcp/server", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "tools/list",
                    params: {},
                    id: 2
                })
            });

            const params = Promise.resolve({
                host: "docs.ada.cx",
                domain: "docs.ada.cx",
                lang: "en"
            });

            const response = await POST(request, { params });

            expect(response.status).not.toBe(404);
            expect(response.status).toBe(200);
        });
    });
});
