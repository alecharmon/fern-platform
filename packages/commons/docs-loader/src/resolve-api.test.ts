import { describe, expect, it, vi } from "vitest";

vi.mock("@fern-api/ui-core-utils/logger", () => ({
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock("@fern-api/fdr-sdk/navigation", () => ({
    ApiDefinitionId: (id: string) => id
}));

vi.mock("@fern-api/fdr-sdk/api-definition", () => ({
    ApiDefinitionV1ToLatest: {
        from: (v1: { id: string }) => ({
            migrate: () => ({ id: v1.id, endpoints: {}, types: {}, webhooks: {}, migrated: true })
        })
    }
}));

import type { RegistryServiceApi } from "./resolve-api";
import { resolveApiDefinition } from "./resolve-api";

// Minimal stubs for API definitions used across tests
const FAKE_V2_API = { id: "api-v2", endpoints: { "GET /plants": {} }, types: {}, webhooks: {} };
const FAKE_LATEST_REGISTRY_API = { id: "api-latest-registry", endpoints: { "POST /plants/{plantId}": {} } };
const FAKE_V1_API = { id: "api-v1" };

function createMockRegistryApi(overrides?: {
    getApiLatest?: RegistryServiceApi["latest"]["getApiLatest"];
    getApi?: RegistryServiceApi["read"]["getApi"];
}): RegistryServiceApi {
    return {
        latest: {
            getApiLatest: overrides?.getApiLatest ?? vi.fn().mockRejectedValue(new Error("not found"))
        },
        read: {
            getApi: overrides?.getApi ?? vi.fn().mockRejectedValue(new Error("not found"))
        }
    };
}

describe("resolveApiDefinition", () => {
    it("returns from apisV2 when the ID is present", async () => {
        const registryApi = createMockRegistryApi();
        const result = await resolveApiDefinition("api-v2", { "api-v2": FAKE_V2_API }, {}, registryApi, "test.com");

        expect(result).toBe(FAKE_V2_API);
        expect(registryApi.latest.getApiLatest).not.toHaveBeenCalled();
        expect(registryApi.read.getApi).not.toHaveBeenCalled();
    });

    it("returns migrated v1 from apis when apisV2 does not have the ID", async () => {
        const registryApi = createMockRegistryApi();
        const result = await resolveApiDefinition("api-v1", {}, { "api-v1": FAKE_V1_API }, registryApi, "test.com");

        expect(result).toHaveProperty("id", "api-v1");
        expect(result).toHaveProperty("migrated", true);
        expect(registryApi.latest.getApiLatest).not.toHaveBeenCalled();
        expect(registryApi.read.getApi).not.toHaveBeenCalled();
    });

    it("prefers apisV2 over apisV1 when both have the ID", async () => {
        const registryApi = createMockRegistryApi();
        const result = await resolveApiDefinition(
            "shared-id",
            { "shared-id": FAKE_V2_API },
            { "shared-id": FAKE_V1_API },
            registryApi,
            "test.com"
        );

        expect(result).toBe(FAKE_V2_API);
    });

    it("falls back to registry/latest when neither apisV2 nor apisV1 has the ID", async () => {
        const getApiLatest = vi.fn().mockResolvedValue(FAKE_LATEST_REGISTRY_API);
        const registryApi = createMockRegistryApi({ getApiLatest });

        const result = await resolveApiDefinition("missing-id", {}, {}, registryApi, "test.com");

        expect(result).toBe(FAKE_LATEST_REGISTRY_API);
        expect(getApiLatest).toHaveBeenCalledWith({ apiDefinitionId: "missing-id" });
        expect(registryApi.read.getApi).not.toHaveBeenCalled();
    });

    it("falls back to registry/read when registry/latest fails", async () => {
        const getApiLatest = vi.fn().mockRejectedValue(new Error("latest unavailable"));
        const getApi = vi.fn().mockResolvedValue(FAKE_V1_API);
        const registryApi = createMockRegistryApi({ getApiLatest, getApi });

        const result = await resolveApiDefinition("missing-id", {}, {}, registryApi, "test.com");

        expect(result).toHaveProperty("id", "api-v1");
        expect(result).toHaveProperty("migrated", true);
        expect(getApiLatest).toHaveBeenCalledWith({ apiDefinitionId: "missing-id" });
        expect(getApi).toHaveBeenCalledWith({ apiDefinitionId: "missing-id" });
    });

    it("throws when all sources fail", async () => {
        const getApiLatest = vi.fn().mockRejectedValue(new Error("latest unavailable"));
        const getApi = vi.fn().mockRejectedValue(new Error("read unavailable"));
        const registryApi = createMockRegistryApi({ getApiLatest, getApi });

        await expect(resolveApiDefinition("missing-id", {}, {}, registryApi, "test.com")).rejects.toThrow(
            /Could not get API with ID/
        );
    });

    it("does not call registry/read if registry/latest succeeds", async () => {
        const getApiLatest = vi.fn().mockResolvedValue(FAKE_LATEST_REGISTRY_API);
        const getApi = vi.fn();
        const registryApi = createMockRegistryApi({ getApiLatest, getApi });

        await resolveApiDefinition("some-id", {}, {}, registryApi, "test.com");

        expect(getApi).not.toHaveBeenCalled();
    });

    it("includes the API ID in the error message when all sources fail", async () => {
        const registryApi = createMockRegistryApi();

        await expect(resolveApiDefinition("my-api-123", {}, {}, registryApi, "test.com")).rejects.toThrow("my-api-123");
    });

    it("includes the underlying error in the thrown error", async () => {
        const getApiLatest = vi.fn().mockRejectedValue(new Error("network timeout"));
        const getApi = vi.fn().mockRejectedValue(new Error("connection refused"));
        const registryApi = createMockRegistryApi({ getApiLatest, getApi });

        await expect(resolveApiDefinition("id", {}, {}, registryApi, "test.com")).rejects.toThrow("connection refused");
    });
});
