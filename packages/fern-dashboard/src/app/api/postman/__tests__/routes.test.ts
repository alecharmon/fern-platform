import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as checkEndpoint } from "../check/route";
import { GET as getStatusEndpoint } from "../publish/collection/[collectionId]/status/route";
import { POST as publishEndpoint } from "../publish/collection/route";
import { POST as updateEndpoint } from "../update/collection/route";

vi.mock("@/app/services/postman/repository", () => ({
    getAppInstallationByTeamId: vi.fn(),
    upsertAppInstallation: vi.fn()
}));

vi.mock("@/app/services/postman/jwt", () => ({
    getPostmanAccessToken: vi.fn(),
    getPostmanBaseUrl: vi.fn(() => "https://api.getpostman.com")
}));

vi.mock("@/app/services/postman/api", () => ({
    fetchPostmanCollection: vi.fn()
}));

vi.mock("@/app/services/dal/github/updateRepository", () => ({
    updateRepository: vi.fn()
}));

vi.mock("@/app/services/dal/github/getDocsGitUrl", () => ({
    getDocsGitUrl: vi.fn()
}));

vi.mock("@/app/services/auth0/fernBotOctokit", () => ({
    getDemoCreationBotOctokit: vi.fn()
}));

const MOCK_API_KEY = "test-postman-api-key";

describe("Postman API endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

        it("returns success response when installation exists and collection is fetched", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
            const { fetchPostmanCollection } = await import("@/app/services/postman/api");

            const mockInstallation = {
                team_id: "team-456",
                shared_secret: "secret-abc",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const mockCollection = { info: { name: "Test Collection" }, item: [] };

            vi.mocked(getAppInstallationByTeamId).mockResolvedValue(mockInstallation);
            vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-access-token");
            vi.mocked(fetchPostmanCollection).mockResolvedValue(mockCollection);

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
            expect(body.collection).toEqual(mockCollection);
        });

        it("polls for installation and succeeds on second attempt", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
            const { fetchPostmanCollection } = await import("@/app/services/postman/api");

            const mockInstallation = {
                team_id: "team-456",
                shared_secret: "secret-abc",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            vi.mocked(getAppInstallationByTeamId).mockResolvedValueOnce(null).mockResolvedValueOnce(mockInstallation);
            vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-access-token");
            vi.mocked(fetchPostmanCollection).mockResolvedValue({ info: { name: "Test" } });

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
            expect(getAppInstallationByTeamId).toHaveBeenCalledTimes(2);
        });

        it("returns 404 when installation is not found after all poll attempts", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            vi.mocked(getAppInstallationByTeamId).mockResolvedValue(null);

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

            expect(response.status).toBe(404);
            expect(body.error).toContain("No app installation found");
        }, 30000);

        it("returns 500 when access token generation fails", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");

            vi.mocked(getAppInstallationByTeamId).mockResolvedValue({
                team_id: "team-456",
                shared_secret: "secret",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            vi.mocked(getPostmanAccessToken).mockRejectedValue(new Error("Token error"));

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

            expect(response.status).toBe(500);
            expect(body.error).toBe("Failed to generate access token");
        });

        it("returns 502 when collection fetch fails", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
            const { fetchPostmanCollection } = await import("@/app/services/postman/api");

            vi.mocked(getAppInstallationByTeamId).mockResolvedValue({
                team_id: "team-456",
                shared_secret: "secret",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-token");
            vi.mocked(fetchPostmanCollection).mockRejectedValue(new Error("Fetch error"));

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

            expect(response.status).toBe(502);
            expect(body.error).toBe("Failed to fetch collection from Postman");
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

    describe("POST /api/postman/update/collection", () => {
        it("returns 401 when no authorization header is provided", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                body: JSON.stringify({
                    payload: {
                        collectionId: "test-collection",
                        userId: "user-123",
                        teamId: "team-456",
                        teamName: "sample",
                        teamDomain: "sample",
                        publishedUrl: "https://sample.docs.buildwithfern.com"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(401);
            expect(body.error).toBe("Unauthorized");
        });

        it("returns 400 when publishedUrl is missing", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: {
                        collectionId: "test-collection",
                        userId: "user-123",
                        teamId: "team-456",
                        teamName: "sample",
                        teamDomain: "sample"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("publishedUrl is required");
        });

        it("returns 400 when collectionId is missing", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: {
                        collectionId: "",
                        userId: "user-123",
                        teamId: "team-456",
                        teamName: "sample",
                        teamDomain: "sample",
                        publishedUrl: "https://sample.docs.buildwithfern.com"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("collectionId is required");
        });

        it("returns 400 when userId and teamId are missing", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: {
                        collectionId: "test-collection",
                        teamName: "sample",
                        teamDomain: "sample",
                        publishedUrl: "https://sample.docs.buildwithfern.com"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("userId and teamId are required");
        });

        it("returns success response when installation exists and collection is fetched", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
            const { fetchPostmanCollection } = await import("@/app/services/postman/api");

            const mockInstallation = {
                team_id: "team-456",
                shared_secret: "secret-abc",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const mockCollection = { info: { name: "Test Collection" }, item: [] };

            vi.mocked(getAppInstallationByTeamId).mockResolvedValue(mockInstallation);
            vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-access-token");
            vi.mocked(fetchPostmanCollection).mockResolvedValue(mockCollection);

            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: {
                        collectionId: "test-collection",
                        userId: "user-123",
                        teamId: "team-456",
                        teamName: "sample",
                        teamDomain: "sample",
                        publishedUrl: "https://sample.docs.buildwithfern.com"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.collectionId).toBe("test-collection");
            expect(body.userId).toBe("user-123");
            expect(body.teamId).toBe("team-456");
            expect(body.collection).toEqual(mockCollection);
        });

        it("returns 404 when installation is not found after all poll attempts", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            vi.mocked(getAppInstallationByTeamId).mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: {
                        collectionId: "test-collection",
                        userId: "user-123",
                        teamId: "team-456",
                        teamName: "sample",
                        teamDomain: "sample",
                        publishedUrl: "https://sample.docs.buildwithfern.com"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toContain("No app installation found");
        }, 30000);

        it("returns 502 when collection fetch fails", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
            const { fetchPostmanCollection } = await import("@/app/services/postman/api");

            vi.mocked(getAppInstallationByTeamId).mockResolvedValue({
                team_id: "team-456",
                shared_secret: "secret",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-token");
            vi.mocked(fetchPostmanCollection).mockRejectedValue(new Error("Fetch error"));

            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    payload: {
                        collectionId: "test-collection",
                        userId: "user-123",
                        teamId: "team-456",
                        teamName: "sample",
                        teamDomain: "sample",
                        publishedUrl: "https://sample.docs.buildwithfern.com"
                    }
                })
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(502);
            expect(body.error).toBe("Failed to fetch collection from Postman");
        });

        it("returns 400 when request body is invalid JSON", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/update/collection", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: "invalid json"
            });

            const response = await updateEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error).toBe("Invalid request body");
        });
    });
});
