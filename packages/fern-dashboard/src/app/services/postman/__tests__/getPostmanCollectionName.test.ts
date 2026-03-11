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

describe("getPostmanCollectionName", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the collection name when all steps succeed", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString()
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

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBe("My API Collection");
        expect(getOpenApiSpecByCollectionId).toHaveBeenCalledWith("col-789");
        expect(getAppInstallationByTeamId).toHaveBeenCalledWith("team-456");
        expect(getPostmanAccessToken).toHaveBeenCalledWith({
            teamId: "team-456",
            installationAuthId: "install-789",
            sharedSecret: "secret-abc"
        });
        expect(fetchPostmanCollection).toHaveBeenCalledWith("mock-access-token", "col-789");
    });

    it("returns undefined when no spec is found for the collection", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue(null);

        const name = await getPostmanCollectionName("col-missing");

        expect(name).toBeUndefined();
        expect(getOpenApiSpecByCollectionId).toHaveBeenCalledWith("col-missing");
    });

    it("returns undefined when no app installation is found for the team", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString()
        });

        vi.mocked(getAppInstallationByTeamId).mockResolvedValue(null);

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBeUndefined();
        expect(getAppInstallationByTeamId).toHaveBeenCalledWith("team-456");
    });

    it("returns undefined when the collection has no info.name", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString()
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

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBeUndefined();
    });

    it("returns undefined when info.name is not a string", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString()
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

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBeUndefined();
    });

    it("returns undefined when getPostmanAccessToken throws", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString()
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

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBeUndefined();
    });

    it("returns undefined when fetchPostmanCollection throws", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getAppInstallationByTeamId } = await import("@/app/services/postman/repository");
        const { getPostmanAccessToken } = await import("@/app/services/postman/jwt");
        const { fetchPostmanCollection } = await import("@/app/services/postman/api");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockResolvedValue({
            id: "spec-1",
            team_id: "team-456",
            user_id: "user-123",
            collection_id: "col-789",
            openapi_spec: {},
            created_at: new Date().toISOString()
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

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBeUndefined();
    });

    it("returns undefined when getOpenApiSpecByCollectionId throws", async () => {
        const { getOpenApiSpecByCollectionId } = await import("@/app/services/postman/openapi-repository");
        const { getPostmanCollectionName } = await import("@/app/services/postman/getPostmanCollectionName");

        vi.mocked(getOpenApiSpecByCollectionId).mockRejectedValue(new Error("DB error"));

        const name = await getPostmanCollectionName("col-789");

        expect(name).toBeUndefined();
    });
});
