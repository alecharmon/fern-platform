import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as checkEndpoint } from "../check/route";
import { GET as getStatusEndpoint } from "../publish/collection/[collectionId]/status/route";
import { POST as publishEndpoint } from "../publish/collection/route";

const MOCK_API_KEY = "test-postman-api-key";

describe("Postman API endpoints", () => {
    beforeEach(() => {
        vi.stubEnv("POSTMAN_FERN_API_KEY", MOCK_API_KEY);
    });

    describe("GET /api/postman/check", () => {
        it("returns 401 when no authorization header is provided", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/check", {
                method: "GET"
            });

            const response = await checkEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.error).toBe("Unauthorized");
        });

        it("returns 401 when authorization header has invalid token", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/check", {
                method: "GET",
                headers: {
                    Authorization: "Bearer invalid-token"
                }
            });

            const response = await checkEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.error).toBe("Unauthorized");
        });

        it("returns 200 with ok: true when valid token is provided", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/check", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`
                }
            });

            const response = await checkEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.ok).toBe(true);
        });

        it("returns 500 when POSTMAN_FERN_API_KEY is not configured", async () => {
            vi.stubEnv("POSTMAN_FERN_API_KEY", "");

            const request = new NextRequest("http://localhost:3000/api/postman/check", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`
                }
            });

            const response = await checkEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.error).toBe("Server misconfiguration");
        });
    });

    describe("GET /api/postman/publish/collection/[collectionId]/status", () => {
        it("returns 401 when no authorization header is provided", async () => {
            const request = new NextRequest(
                "http://localhost:3000/api/postman/publish/collection/test-collection/status",
                {
                    method: "GET"
                }
            );

            const response = await getStatusEndpoint(request, {
                params: Promise.resolve({ collectionId: "test-collection" })
            });
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.error).toBe("Unauthorized");
        });

        it("returns mock published status when valid token is provided", async () => {
            const request = new NextRequest(
                "http://localhost:3000/api/postman/publish/collection/test-collection/status",
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${MOCK_API_KEY}`
                    }
                }
            );

            const response = await getStatusEndpoint(request, {
                params: Promise.resolve({ collectionId: "test-collection" })
            });
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.type).toBe("published");
            expect(body.url).toBe("https://docs.example.com/test-collection");
            expect(body.publishedAt).toBeDefined();
        });

        it("returns 400 when collectionId is empty", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection//status", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`
                }
            });

            const response = await getStatusEndpoint(request, {
                params: Promise.resolve({ collectionId: "" })
            });
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("collectionId is required");
        });
    });

    describe("POST /api/postman/publish/collection", () => {
        it("returns 401 when no authorization header is provided", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection", {
                method: "POST",
                body: JSON.stringify({
                    payload: { collectionId: "test-collection", userId: "user-123", teamId: "team-456" }
                })
            });

            const response = await publishEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.error).toBe("Unauthorized");
        });

        it("returns success response when valid token and body are provided", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: { collectionId: "test-collection", userId: "user-123", teamId: "team-456" }
                })
            });

            const response = await publishEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.collectionId).toBe("test-collection");
            expect(body.userId).toBe("user-123");
            expect(body.teamId).toBe("team-456");
            expect(body.message).toBe("Collection publish initiated");
        });

        it("returns 400 when userId is missing", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ payload: { collectionId: "test-collection", teamId: "team-456" } })
            });

            const response = await publishEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("userId and teamId are required");
        });

        it("returns 400 when teamId is missing", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ payload: { collectionId: "test-collection", userId: "user-123" } })
            });

            const response = await publishEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("userId and teamId are required");
        });

        it("returns 400 when request body is invalid JSON", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: "invalid json"
            });

            const response = await publishEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("Invalid request body");
        });

        it("returns 400 when collectionId is empty", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ payload: { collectionId: "", userId: "user-123", teamId: "team-456" } })
            });

            const response = await publishEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("collectionId is required");
        });
    });
});
