import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    AUTH0_ERROR_CODES,
    auth0Error,
    SUPABASE_ERROR_CODES,
    supabaseError,
    type UserPermissionsError
} from "./errors";

describe("error factories", () => {
    describe("supabaseError", () => {
        it("should create a SupabaseError with correct source", () => {
            const error = supabaseError("QUERY_FAILED", "Failed to query");
            expect(error.source).toBe("supabase");
            expect(error.code).toBe("QUERY_FAILED");
            expect(error.message).toBe("Failed to query");
        });

        it("should create errors for all Supabase error codes", () => {
            for (const code of SUPABASE_ERROR_CODES) {
                const error = supabaseError(code, `Test ${code}`);
                expect(error.source).toBe("supabase");
                expect(error.code).toBe(code);
            }
        });
    });

    describe("auth0Error", () => {
        it("should create an Auth0Error with correct source", () => {
            const error = auth0Error("API_FAILED", "API call failed");
            expect(error.source).toBe("auth0");
            expect(error.code).toBe("API_FAILED");
            expect(error.message).toBe("API call failed");
        });

        it("should create errors for all Auth0 error codes", () => {
            for (const code of AUTH0_ERROR_CODES) {
                const error = auth0Error(code, `Test ${code}`);
                expect(error.source).toBe("auth0");
                expect(error.code).toBe(code);
            }
        });
    });

    describe("type discrimination", () => {
        it("should allow narrowing by source field", () => {
            const errors: UserPermissionsError[] = [
                supabaseError("NOT_CONFIGURED", "Supabase not configured"),
                auth0Error("NOT_CONFIGURED", "Auth0 not configured")
            ];

            for (const error of errors) {
                if (error.source === "supabase") {
                    // TypeScript should know error.code is SupabaseErrorCode
                    expect(SUPABASE_ERROR_CODES).toContain(error.code);
                } else {
                    // TypeScript should know error.code is Auth0ErrorCode
                    expect(AUTH0_ERROR_CODES).toContain(error.code);
                }
            }
        });
    });
});

describe("getClient Result integration", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("should return error when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.DATABASE_URL;

        const { getClientResult } = await import("./resource-permissions");
        const result = getClientResult();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.source).toBe("supabase");
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("should return error when no URL is configured", async () => {
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
        delete process.env.SUPABASE_URL;
        delete process.env.DATABASE_URL;

        const { getClientResult } = await import("./resource-permissions");
        const result = getClientResult();

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.source).toBe("supabase");
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });
});

describe("getUserRolesResult", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("should return error when client is not configured", async () => {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.DATABASE_URL;

        const { getUserRolesResult } = await import("./resource-permissions");
        const result = await getUserRolesResult({ orgId: "org-1", userId: "user-1" });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.source).toBe("supabase");
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });
});

describe("Supabase ResultAsync functions", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.DATABASE_URL;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("getUserRolesForResourceResult returns error when not configured", async () => {
        const { getUserRolesForResourceResult } = await import("./resource-permissions");
        const result = await getUserRolesForResourceResult({
            orgId: "org-1",
            userId: "user-1",
            resourceType: "docs",
            resourceId: "doc-1"
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("getResourceUsersResult returns error when not configured", async () => {
        const { getResourceUsersResult } = await import("./resource-permissions");
        const result = await getResourceUsersResult({
            orgId: "org-1",
            resourceType: "docs",
            resourceId: "doc-1"
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("getRolePermissionsResult returns error when not configured", async () => {
        const { getRolePermissionsResult } = await import("./resource-permissions");
        const result = await getRolePermissionsResult("admin");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("getAllRolePermissionsResult returns error when not configured", async () => {
        const { getAllRolePermissionsResult } = await import("./resource-permissions");
        const result = await getAllRolePermissionsResult();
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("getUserPermissionsForResourceResult returns error when not configured", async () => {
        const { getUserPermissionsForResourceResult } = await import("./resource-permissions");
        const result = await getUserPermissionsForResourceResult({
            userId: "user-1",
            orgId: "org-1",
            resourceType: "docs",
            resourceId: "doc-1"
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("hasUserPermissionForResourceResult returns error when not configured", async () => {
        const { hasUserPermissionForResourceResult } = await import("./resource-permissions");
        const result = await hasUserPermissionForResourceResult({
            userId: "user-1",
            orgId: "org-1",
            resourceType: "docs",
            resourceId: "doc-1",
            permission: "view"
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });

    it("getUserAccessibleResourcesResult returns error when not configured", async () => {
        const { getUserAccessibleResourcesResult } = await import("./resource-permissions");
        const result = await getUserAccessibleResourcesResult({
            userId: "user-1",
            resourceType: "docs"
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });
});

describe("Supabase mutation ResultAsync functions", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.DATABASE_URL;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("addUserRoleForResourceResult returns error when not configured", async () => {
        const { addUserRoleForResourceResult } = await import("./resource-permissions");
        const result = await addUserRoleForResourceResult({
            org_id: "org-1",
            user_id: "user-1",
            resource_type: "docs",
            resource_id: "doc-1",
            role: "admin"
        });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
    });

    it("removeUserRoleForResourceResult returns error when not configured", async () => {
        const { removeUserRoleForResourceResult } = await import("./resource-permissions");
        const result = await removeUserRoleForResourceResult({
            orgId: "org-1",
            userId: "user-1",
            resourceType: "docs",
            resourceId: "doc-1",
            role: "admin"
        });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
    });

    it("removeAllUserRolesForResourceResult returns error when not configured", async () => {
        const { removeAllUserRolesForResourceResult } = await import("./resource-permissions");
        const result = await removeAllUserRolesForResourceResult({
            orgId: "org-1",
            userId: "user-1",
            resourceType: "docs",
            resourceId: "doc-1"
        });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
    });

    it("addRolePermissionResult returns error when not configured", async () => {
        const { addRolePermissionResult } = await import("./resource-permissions");
        const result = await addRolePermissionResult({ role: "admin", permission: "view" });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
    });

    it("removeRolePermissionResult returns error when not configured", async () => {
        const { removeRolePermissionResult } = await import("./resource-permissions");
        const result = await removeRolePermissionResult({ role: "admin", permission: "view" });
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
    });
});
