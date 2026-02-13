import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTHZ_PERMISSIONS, type AuthZPermission } from "./permissions";
import { DEFAULT_ROLE_PERMISSIONS, type Roles } from "./roles";

const ROLE_MAP = JSON.stringify({
    admin: "rol_admin",
    editor: "rol_editor",
    viewer: "rol_viewer",
    cli: "rol_cli",
    fine_grain: "rol_fine_grain"
});

function mockAuth0WithRoles(roleNames: string[]) {
    vi.doMock("auth0", () => ({
        ManagementClient: vi.fn().mockImplementation(() => ({
            organizations: {
                getMemberRoles: vi.fn().mockResolvedValue({
                    data: roleNames.map((name) => ({ name })),
                    status: 200,
                    statusText: "OK",
                    headers: {}
                })
            }
        }))
    }));
}

function mockAuth0WithError(error: Error) {
    vi.doMock("auth0", () => ({
        ManagementClient: vi.fn().mockImplementation(() => ({
            organizations: {
                getMemberRoles: vi.fn().mockRejectedValue(error)
            }
        }))
    }));
}

describe("DEFAULT_ROLE_PERMISSIONS", () => {
    it("should grant admin all permissions", () => {
        expect(DEFAULT_ROLE_PERMISSIONS.admin).toEqual([...AUTHZ_PERMISSIONS]);
    });

    it("should grant editor edit and view permissions", () => {
        expect(DEFAULT_ROLE_PERMISSIONS.editor).toEqual(["edit", "view"]);
    });

    it("should grant viewer only view permission", () => {
        expect(DEFAULT_ROLE_PERMISSIONS.viewer).toEqual(["view"]);
    });

    it("should grant cli only cli permission", () => {
        expect(DEFAULT_ROLE_PERMISSIONS.cli).toEqual(["cli"]);
    });

    it("should grant fine_grain no permissions", () => {
        expect(DEFAULT_ROLE_PERMISSIONS.fine_grain).toEqual([]);
    });

    it("should have an entry for every role type", () => {
        const expectedRoles: Roles[] = ["admin", "editor", "viewer", "cli", "fine_grain"];
        expect(Object.keys(DEFAULT_ROLE_PERMISSIONS).sort()).toEqual(expectedRoles.sort());
    });

    it("should only contain valid AuthZPermission values", () => {
        const allPermissions = Object.values(DEFAULT_ROLE_PERMISSIONS).flat();
        const validPermissions = new Set<AuthZPermission>(AUTHZ_PERMISSIONS);
        for (const perm of allPermissions) {
            expect(validPermissions.has(perm)).toBe(true);
        }
    });

    it("editor permissions should be a subset of admin permissions", () => {
        for (const perm of DEFAULT_ROLE_PERMISSIONS.editor) {
            expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain(perm);
        }
    });

    it("viewer permissions should be a subset of editor permissions", () => {
        for (const perm of DEFAULT_ROLE_PERMISSIONS.viewer) {
            expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain(perm);
        }
    });
});

describe("getDefaultPermissionsForOrgUser", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        delete process.env.AUTH0_DOMAIN;
        delete process.env.AUTH0_CLIENT_ID;
        delete process.env.AUTH0_CLIENT_SECRET;
        delete process.env.AUTH0_ROLES;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe("error cases", () => {
        it("should return NOT_CONFIGURED error when Auth0 env vars are missing", async () => {
            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });
            expect(result.isErr()).toBe(true);
            expect(result._unsafeUnwrapErr().source).toBe("auth0");
            expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
        });

        it("should return ROLE_MAPPING_INVALID error when AUTH0_ROLES is missing", async () => {
            process.env.AUTH0_DOMAIN = "test.auth0.com";
            process.env.AUTH0_CLIENT_ID = "test-client-id";
            process.env.AUTH0_CLIENT_SECRET = "test-secret";

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });
            expect(result.isErr()).toBe(true);
            expect(result._unsafeUnwrapErr().code).toBe("ROLE_MAPPING_INVALID");
        });

        it("should return API_FAILED error when management API call fails", async () => {
            process.env.AUTH0_DOMAIN = "test.auth0.com";
            process.env.AUTH0_CLIENT_ID = "test-client-id";
            process.env.AUTH0_CLIENT_SECRET = "test-secret";
            process.env.AUTH0_ROLES = ROLE_MAP;

            mockAuth0WithError(new Error("Network error"));

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isErr()).toBe(true);
            expect(result._unsafeUnwrapErr().code).toBe("API_FAILED");
            expect(result._unsafeUnwrapErr().message).toContain("Network error");
        });
    });

    describe("single role", () => {
        beforeEach(() => {
            process.env.AUTH0_DOMAIN = "test.auth0.com";
            process.env.AUTH0_CLIENT_ID = "test-client-id";
            process.env.AUTH0_CLIENT_SECRET = "test-secret";
            process.env.AUTH0_ROLES = ROLE_MAP;
        });

        it("should return all permissions for admin role", async () => {
            mockAuth0WithRoles(["admin"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.ok).toBe(true);
                expect(result.value.data).toEqual([...AUTHZ_PERMISSIONS]);
            }
        });

        it("should return edit and view for editor role", async () => {
            mockAuth0WithRoles(["editor"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.data).toEqual(["edit", "view"]);
            }
        });

        it("should return only view for viewer role", async () => {
            mockAuth0WithRoles(["viewer"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.data).toEqual(["view"]);
            }
        });

        it("should return only cli for cli role", async () => {
            mockAuth0WithRoles(["cli"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.data).toEqual(["cli"]);
            }
        });

        it("should return empty for fine_grain role", async () => {
            mockAuth0WithRoles(["fine_grain"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.data).toEqual([]);
            }
        });
    });

    describe("multiple roles", () => {
        beforeEach(() => {
            process.env.AUTH0_DOMAIN = "test.auth0.com";
            process.env.AUTH0_CLIENT_ID = "test-client-id";
            process.env.AUTH0_CLIENT_SECRET = "test-secret";
            process.env.AUTH0_ROLES = ROLE_MAP;
        });

        it("should deduplicate permissions from editor + viewer", async () => {
            mockAuth0WithRoles(["editor", "viewer"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                // editor=["edit","view"], viewer=["view"] → deduplicated to ["edit","view"]
                expect(result.value.data).toEqual(["edit", "view"]);
                expect(result.value.data.filter((p) => p === "view")).toHaveLength(1);
            }
        });

        it("should combine cli + viewer permissions", async () => {
            mockAuth0WithRoles(["cli", "viewer"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.data).toContain("cli");
                expect(result.value.data).toContain("view");
                expect(result.value.data).toHaveLength(2);
            }
        });

        it("should return empty for no roles", async () => {
            mockAuth0WithRoles([]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.data).toEqual([]);
            }
        });

        it("should ignore unknown roles from Auth0", async () => {
            mockAuth0WithRoles(["viewer", "unknown_role"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                // unknown_role is filtered by getRolesResult before reaching DEFAULT_ROLE_PERMISSIONS
                expect(result.value.data).toEqual(["view"]);
            }
        });

        it("should handle fine_grain + viewer without adding extra permissions", async () => {
            mockAuth0WithRoles(["fine_grain", "viewer"]);

            const { getDefaultPermissionsForOrgUser } = await import("./roles");
            const result = await getDefaultPermissionsForOrgUser({
                userId: "user-1",
                orgId: "org-1"
            });

            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                // fine_grain=[], viewer=["view"] → ["view"]
                expect(result.value.data).toEqual(["view"]);
            }
        });
    });
});
