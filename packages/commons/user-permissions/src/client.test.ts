import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

describe("getManagementClientResult", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("should return error when AUTH0_DOMAIN is missing", async () => {
        delete process.env.AUTH0_DOMAIN;
        process.env.AUTH0_CLIENT_ID = "test-client-id";
        process.env.AUTH0_CLIENT_SECRET = "test-secret";

        const { getManagementClientResult } = await import("./client");
        const result = getManagementClientResult();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.source).toBe("auth0");
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("should return error when AUTH0_CLIENT_ID is missing", async () => {
        process.env.AUTH0_DOMAIN = "test.auth0.com";
        delete process.env.AUTH0_CLIENT_ID;
        process.env.AUTH0_CLIENT_SECRET = "test-secret";

        const { getManagementClientResult } = await import("./client");
        const result = getManagementClientResult();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.source).toBe("auth0");
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("should return error when AUTH0_CLIENT_SECRET is missing", async () => {
        process.env.AUTH0_DOMAIN = "test.auth0.com";
        process.env.AUTH0_CLIENT_ID = "test-client-id";
        delete process.env.AUTH0_CLIENT_SECRET;

        const { getManagementClientResult } = await import("./client");
        const result = getManagementClientResult();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.source).toBe("auth0");
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("should return ok when all config is present", async () => {
        process.env.AUTH0_DOMAIN = "test.auth0.com";
        process.env.AUTH0_CLIENT_ID = "test-client-id";
        process.env.AUTH0_CLIENT_SECRET = "test-secret";

        const { getManagementClientResult } = await import("./client");
        const result = getManagementClientResult();

        expect(result.isOk()).toBe(true);
    });
});

describe("Auth0 role functions with Result", () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env.AUTH0_DOMAIN;
        delete process.env.AUTH0_CLIENT_ID;
        delete process.env.AUTH0_CLIENT_SECRET;
        delete process.env.AUTH0_ROLES;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("addRolesResult returns error when Auth0 not configured", async () => {
        const { addRolesResult } = await import("./roles");
        const result = await addRolesResult({
            userId: "user-1",
            orgId: "org-1",
            roleNames: ["admin"]
        });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().source).toBe("auth0");
    });

    it("removeRolesResult returns error when Auth0 not configured", async () => {
        const { removeRolesResult } = await import("./roles");
        const result = await removeRolesResult({
            userId: "user-1",
            orgId: "org-1",
            roleNames: ["admin"]
        });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().source).toBe("auth0");
    });

    it("getRolesResult returns error when Auth0 not configured", async () => {
        const { getRolesResult } = await import("./roles");
        const result = await getRolesResult({
            userId: "user-1",
            orgId: "org-1"
        });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().source).toBe("auth0");
    });

    it("getRoleMappingResult returns error when AUTH0_ROLES not configured", async () => {
        const { getRoleMappingResult } = await import("./roles");
        const result = getRoleMappingResult();
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("ROLE_MAPPING_INVALID");
    });
});
