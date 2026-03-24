// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/app/services/postman/openapi-repository", () => ({
    getOpenApiSpecByCollectionId: vi.fn()
}));

vi.mock("@/app/services/postman/repository", () => ({
    getAppInstallationByTeamId: vi.fn()
}));

vi.mock("@/app/services/postman/jwt", () => ({
    getPostmanAccessToken: vi.fn()
}));

vi.mock("@/app/services/postman/api", () => ({
    fetchPostmanCollection: vi.fn()
}));

describe("getPostmanCollectionInfo", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns collection info with name, teamDomain, and workspaceId when all steps succeed", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: "ws-abc"
        });

        vi.mocked(getAppInstallationByTeamId).mockResolvedValue({
            team_id: "team-456",
            shared_secret: "secret-abc",
            app_installation_id: "install-789",
            team_name: "Test Team",
            team_domain: "test-team",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        vi.mocked(getPostmanAccessToken).mockResolvedValue("mock-access-token");

        vi.mocked(fetchPostmanCollection).mockResolvedValue({
            info: { name: "My API Collection" },
            item: []
        });

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toEqual({
            name: "My API Collection",
            collectionId: "col-789",
            teamName: "Test Team",
            teamDomain: "test-team",
            workspaceId: "ws-abc"
        });
        expect(getOpenApiSpecByCollectionId).toHaveBeenCalledWith("col-789");
        expect(getAppInstallationByTeamId).toHaveBeenCalledWith("team-456");
        expect(getPostmanAccessToken).toHaveBeenCalledWith({
            teamId: "team-456",
            installationAuthId: "install-789",
            sharedSecret: "secret-abc"
        });
        expect(fetchPostmanCollection).toHaveBeenCalledWith("mock-access-token", "col-789");
    });

    it("returns null teamDomain and workspaceId when they are missing", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: null
        });

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

        vi.mocked(fetchPostmanCollection).mockResolvedValue({
            info: { name: "My API Collection" },
            item: []
        });

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toEqual({
            name: "My API Collection",
            collectionId: "col-789",
            teamName: null,
            teamDomain: null,
            workspaceId: null
        });
    });

    it("returns undefined when no spec is found for the collection", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue(null);

        const result = await getPostmanCollectionInfo("col-missing");

        expect(result).toBeUndefined();
        expect(getOpenApiSpecByCollectionId).toHaveBeenCalledWith("col-missing");
    });

    it("returns undefined when no app installation is found for the team", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: null
        });

        vi.mocked(getAppInstallationByTeamId).mockResolvedValue(null);

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toBeUndefined();
        expect(getAppInstallationByTeamId).toHaveBeenCalledWith("team-456");
    });

    it("returns undefined when the collection has no info.name", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: null
        });

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
        vi.mocked(fetchPostmanCollection).mockResolvedValue({ item: [] });

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toBeUndefined();
    });

    it("returns undefined when info.name is not a string", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: null
        });

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
        vi.mocked(fetchPostmanCollection).mockResolvedValue({ info: { name: 123 } });

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toBeUndefined();
    });

    it("returns undefined when getPostmanAccessToken throws", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: null
        });

        vi.mocked(getAppInstallationByTeamId).mockResolvedValue({
            team_id: "team-456",
            shared_secret: "secret-abc",
            app_installation_id: "install-789",
            team_name: null,
            team_domain: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        vi.mocked(getPostmanAccessToken).mockRejectedValue(new Error("Token error"));

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toBeUndefined();
    });

    it("returns undefined when fetchPostmanCollection throws", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString(),
            workspace_id: null
        });

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
        vi.mocked(fetchPostmanCollection).mockRejectedValue(new Error("API error"));

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toBeUndefined();
    });

    it("returns undefined when getOpenApiSpecByCollectionId throws", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getPostmanCollectionInfo } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockRejectedValue(new Error("DB error"));

        const result = await getPostmanCollectionInfo("col-789");

        expect(result).toBeUndefined();
    });
});
