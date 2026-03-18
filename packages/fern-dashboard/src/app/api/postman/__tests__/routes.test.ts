import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as checkEndpoint } from "../check/route";
import { POST as notifyDeletedEndpoint } from "../notify-deleted/route";
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

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: vi.fn()
}));

vi.mock("@/app/services/venus/getVenusClient", () => ({
    getVenusClient: vi.fn()
}));

vi.mock("@/app/services/postman/openapi-repository", () => ({
    getOpenApiSpecByCollectionId: vi.fn(),
    getLatestOpenApiSpecByTeamId: vi.fn(),
    getAllOpenApiSpecsByTeamId: vi.fn(),
    deleteOpenApiSpecsByTeamId: vi.fn(),
    isUserInTeam: vi.fn(),
    upsertOpenApiSpec: vi.fn()
}));

vi.mock("@/app/services/postman/notifyPostman", () => ({
    notifyPostman: vi.fn()
}));

vi.mock("@/app/services/postman/notifyPostmanDeleted", () => ({
    notifyPostmanDeleted: vi.fn()
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

        it("returns published status when collection exists in database", async () => {
            const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
            vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
                id: "spec-1",
                team_id: "team-456",
                user_id: "user-123",
                collection_id: "test-collection",
                openapi_spec: {},
                created_at: "2026-03-13T12:00:00.000Z",
                workspace_id: null
            });

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
            expect(body.url).toBe("https://test-collection.docs.buildwithfern.com");
            expect(body.publishedAt).toBe("2026-03-13T12:00:00.000Z");
        });

        it("returns 404 when collection does not exist", async () => {
            const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
            vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue(null);

            const request = new NextRequest("http://localhost:3000/api/postman/publish/collection/nonexistent/status", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${MOCK_API_KEY}`
                }
            });

            const response = await getStatusEndpoint(request, {
                params: Promise.resolve({ collectionId: "nonexistent" })
            });
            const body = await response.json();

            expect(response.status).toBe(404);
            expect(body.error).toBe("CollectionDoesNotExist");
            expect(body.collectionId).toBe("nonexistent");
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
            const { notifyPostman } = await import("@/app/services/postman/notifyPostman");

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
            vi.mocked(notifyPostman).mockResolvedValue(undefined);

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

            expect(notifyPostman).toHaveBeenCalledWith({
                teamId: "team-456",
                collectionId: "test-collection",
                siteUrl: "sample.docs.buildwithfern.com",
                generationStatus: "SUCCESS"
            });
        });

        it("still returns success when notifyPostman fails", async () => {
            const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
            const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
            const { fetchPostmanCollection } = await import("@/app/services/postman/api");
            const { notifyPostman } = await import("@/app/services/postman/notifyPostman");

            vi.mocked(getAppInstallationByTeamId).mockResolvedValue({
                team_id: "team-456",
                shared_secret: "secret-abc",
                app_installation_id: "install-789",
                team_name: null,
                team_domain: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-access-token");
            vi.mocked(fetchPostmanCollection).mockResolvedValue({ info: { name: "Test" }, item: [] });
            vi.mocked(notifyPostman).mockRejectedValue(new Error("Notification failed"));

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

            // Should still succeed even if notification fails
            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(notifyPostman).toHaveBeenCalledTimes(1);
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

    describe("POST /api/postman/notify-deleted", () => {
        const MOCK_SESSION = {
            user: { sub: "auth0|user-123", name: "Test User", email: "test@example.com" },
            accessToken: "mock-access-token"
        };

        function createNotifyDeletedRequest(body: string | object) {
            return new NextRequest("http://localhost:3000/api/postman/notify-deleted", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: typeof body === "string" ? body : JSON.stringify(body)
            });
        }

        it("returns 401 when no session exists", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            vi.mocked(getCurrentSession).mockResolvedValue(undefined);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);

            expect(response.status).toBe(401);
            expect(await response.text()).toBe("Unauthorized");
        });

        it("returns 400 when request body is invalid JSON", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const request = createNotifyDeletedRequest("invalid json");
            const response = await notifyDeletedEndpoint(request);

            expect(response.status).toBe(400);
            expect(await response.text()).toBe("Invalid request body");
        });

        it("returns 400 when organizationId is missing", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const request = createNotifyDeletedRequest({ organizationId: "" });
            const response = await notifyDeletedEndpoint(request);

            expect(response.status).toBe(400);
            expect(await response.text()).toBe("organizationId is required");
        });

        it("returns 500 when Venus org lookup fails", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: false, error: "Not found" }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Failed to get organization");
        });

        it("returns 403 when user is not a member of the organization", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: false })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);

            expect(response.status).toBe(403);
            expect(await response.text()).toBe("Forbidden");
        });

        it("returns 403 when isMember call fails", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: false })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);

            expect(response.status).toBe(403);
            expect(await response.text()).toBe("Forbidden");
        });

        it("returns success with skipped when organization has no Postman integration", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: undefined } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.skipped).toBe(true);
        });

        it("returns success with skipped when no specs are found for the team", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId } = await import("@/app/services/postman/openapi-repository");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue(null);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.skipped).toBe(true);
        });

        it("returns success with skipped when specs array is empty", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId } = await import("@/app/services/postman/openapi-repository");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue([]);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.skipped).toBe(true);
        });

        it("notifies Postman for a single collection and deletes specs", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId, deleteOpenApiSpecsByTeamId } = await import(
                "@/app/services/postman/openapi-repository"
            );
            const { notifyPostmanDeleted } = await import("@/app/services/postman/notifyPostmanDeleted");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue([
                {
                    id: "spec-1",
                    team_id: "team-123",
                    user_id: "user-1",
                    collection_id: "collection-1",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                }
            ]);
            vi.mocked(notifyPostmanDeleted).mockResolvedValue(undefined);
            vi.mocked(deleteOpenApiSpecsByTeamId).mockResolvedValue(undefined);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(notifyPostmanDeleted).toHaveBeenCalledTimes(1);
            expect(notifyPostmanDeleted).toHaveBeenCalledWith({ teamId: "team-123", collectionId: "collection-1" });
            expect(deleteOpenApiSpecsByTeamId).toHaveBeenCalledWith("team-123");
        });

        it("notifies Postman for multiple collections and deletes all specs", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId, deleteOpenApiSpecsByTeamId } = await import(
                "@/app/services/postman/openapi-repository"
            );
            const { notifyPostmanDeleted } = await import("@/app/services/postman/notifyPostmanDeleted");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue([
                {
                    id: "spec-1",
                    team_id: "team-123",
                    user_id: "user-1",
                    collection_id: "collection-1",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                },
                {
                    id: "spec-2",
                    team_id: "team-123",
                    user_id: "user-2",
                    collection_id: "collection-2",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                },
                {
                    id: "spec-3",
                    team_id: "team-123",
                    user_id: "user-3",
                    collection_id: "collection-3",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                }
            ]);
            vi.mocked(notifyPostmanDeleted).mockResolvedValue(undefined);
            vi.mocked(deleteOpenApiSpecsByTeamId).mockResolvedValue(undefined);

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.success).toBe(true);
            expect(notifyPostmanDeleted).toHaveBeenCalledTimes(3);
            expect(notifyPostmanDeleted).toHaveBeenCalledWith({ teamId: "team-123", collectionId: "collection-1" });
            expect(notifyPostmanDeleted).toHaveBeenCalledWith({ teamId: "team-123", collectionId: "collection-2" });
            expect(notifyPostmanDeleted).toHaveBeenCalledWith({ teamId: "team-123", collectionId: "collection-3" });
            expect(deleteOpenApiSpecsByTeamId).toHaveBeenCalledTimes(1);
            expect(deleteOpenApiSpecsByTeamId).toHaveBeenCalledWith("team-123");
        });

        it("returns 500 when notifyPostmanDeleted throws an error", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId } = await import("@/app/services/postman/openapi-repository");
            const { notifyPostmanDeleted } = await import("@/app/services/postman/notifyPostmanDeleted");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue([
                {
                    id: "spec-1",
                    team_id: "team-123",
                    user_id: "user-1",
                    collection_id: "collection-1",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                }
            ]);
            vi.mocked(notifyPostmanDeleted).mockRejectedValue(new Error("Notification failed"));

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Notification failed");
        });

        it("returns 500 with generic message when non-Error is thrown", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId } = await import("@/app/services/postman/openapi-repository");
            const { notifyPostmanDeleted } = await import("@/app/services/postman/notifyPostmanDeleted");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue([
                {
                    id: "spec-1",
                    team_id: "team-123",
                    user_id: "user-1",
                    collection_id: "collection-1",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                }
            ]);
            vi.mocked(notifyPostmanDeleted).mockRejectedValue("string error");

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Failed to notify Postman");
        });

        it("returns 500 when deleteOpenApiSpecsByTeamId throws", async () => {
            const { getCurrentSession } = await import("@/app/services/auth0/getCurrentSession");
            const { getVenusClient } = await import("@/app/services/venus/getVenusClient");
            const { getAllOpenApiSpecsByTeamId, deleteOpenApiSpecsByTeamId } = await import(
                "@/app/services/postman/openapi-repository"
            );
            const { notifyPostmanDeleted } = await import("@/app/services/postman/notifyPostmanDeleted");
            vi.mocked(getCurrentSession).mockResolvedValue(MOCK_SESSION);

            const mockVenus = {
                organization: {
                    get: vi.fn().mockResolvedValue({ ok: true, body: { postmanTeamId: "team-123" } }),
                    isMember: vi.fn().mockResolvedValue({ ok: true, body: true })
                }
            };
            vi.mocked(getVenusClient).mockReturnValue(mockVenus as any);
            vi.mocked(getAllOpenApiSpecsByTeamId).mockResolvedValue([
                {
                    id: "spec-1",
                    team_id: "team-123",
                    user_id: "user-1",
                    collection_id: "collection-1",
                    openapi_spec: {},
                    created_at: new Date().toISOString()
                }
            ]);
            vi.mocked(notifyPostmanDeleted).mockResolvedValue(undefined);
            vi.mocked(deleteOpenApiSpecsByTeamId).mockRejectedValue(new Error("Delete failed"));

            const request = createNotifyDeletedRequest({ organizationId: "org-123" });
            const response = await notifyDeletedEndpoint(request);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.success).toBe(false);
            expect(body.error).toBe("Delete failed");
        });
    });
});
