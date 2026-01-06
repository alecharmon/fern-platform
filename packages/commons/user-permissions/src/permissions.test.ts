import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createScopedPermission,
    FINE_GRAIN_PERMISSION,
    getPermissionsFromSession,
    getPermittedResourceIds,
    getResourcePermissions,
    hasFineGrainPermission,
    hasPermission,
    hasResourcePermission,
    hasRoutePermission,
    isAuthZPermission,
    parseScopedPermission,
    type RoutePermissionConfig
} from "./permissions";
import * as resourcePermissions from "./resource-permissions";

describe("isAuthZPermission", () => {
    it("should return true for valid permissions", () => {
        expect(isAuthZPermission("view")).toBe(true);
        expect(isAuthZPermission("edit")).toBe(true);
        expect(isAuthZPermission("manage-users")).toBe(true);
        expect(isAuthZPermission("manage-settings")).toBe(true);
        expect(isAuthZPermission("cli")).toBe(true);
        expect(isAuthZPermission("super-user")).toBe(true);
    });

    it("should return false for invalid permissions", () => {
        expect(isAuthZPermission("invalid")).toBe(false);
        expect(isAuthZPermission("")).toBe(false);
        expect(isAuthZPermission(123)).toBe(false);
        expect(isAuthZPermission(null)).toBe(false);
        expect(isAuthZPermission(undefined)).toBe(false);
    });
});

describe("hasPermission", () => {
    describe("org-level permissions", () => {
        it("should return true when user has the exact permission", () => {
            expect(hasPermission(["view"], "view")).toBe(true);
            expect(hasPermission(["edit"], "edit")).toBe(true);
        });

        it("should return false when user lacks the permission", () => {
            expect(hasPermission(["view"], "edit")).toBe(false);
            expect(hasPermission([], "view")).toBe(false);
        });

        it("should return true for super-user checking any permission", () => {
            expect(hasPermission(["super-user"], "view")).toBe(true);
            expect(hasPermission(["super-user"], "edit")).toBe(true);
            expect(hasPermission(["super-user"], "manage-users")).toBe(true);
            expect(hasPermission(["super-user"], "manage-settings")).toBe(true);
            expect(hasPermission(["super-user"], "cli")).toBe(true);
        });

        it("should work with multiple permissions", () => {
            expect(hasPermission(["view", "edit"], "view")).toBe(true);
            expect(hasPermission(["view", "edit"], "edit")).toBe(true);
            expect(hasPermission(["view", "edit"], "manage-users")).toBe(false);
        });
    });
});

describe("getPermissionsFromSession", () => {
    it("should return empty array for undefined session permissions", () => {
        expect(getPermissionsFromSession({ sessionPermissions: undefined })).toEqual([]);
    });

    it("should filter out invalid permissions", () => {
        expect(
            getPermissionsFromSession({
                sessionPermissions: ["view", "invalid", "edit", "also-invalid"]
            })
        ).toEqual(["view", "edit"]);
    });

    it("should filter out scoped permissions (they are not org-level)", () => {
        expect(
            getPermissionsFromSession({
                sessionPermissions: ["view", "edit:docs:site-123", "edit"]
            })
        ).toEqual(["view", "edit"]);
    });

    it("should return all valid permissions", () => {
        expect(
            getPermissionsFromSession({
                sessionPermissions: ["view", "edit", "manage-users", "super-user"]
            })
        ).toEqual(["view", "edit", "manage-users", "super-user"]);
    });
});

describe("parseScopedPermission", () => {
    it("should parse valid scoped permission strings", () => {
        expect(parseScopedPermission("view:docs:site-123")).toEqual({
            permission: "view",
            resourceType: "docs",
            resourceId: "site-123"
        });
        expect(parseScopedPermission("edit:docs:my-doc-site")).toEqual({
            permission: "edit",
            resourceType: "docs",
            resourceId: "my-doc-site"
        });
    });

    it("should return undefined for invalid permission type", () => {
        expect(parseScopedPermission("invalid:docs:site-123")).toBeUndefined();
    });

    it("should return undefined for invalid resource type", () => {
        expect(parseScopedPermission("view:invalid:site-123")).toBeUndefined();
    });

    it("should return undefined for missing resource id", () => {
        expect(parseScopedPermission("view:docs:")).toBeUndefined();
    });

    it("should return undefined for wrong number of parts", () => {
        expect(parseScopedPermission("view")).toBeUndefined();
        expect(parseScopedPermission("view:docs")).toBeUndefined();
        expect(parseScopedPermission("view:docs:site:extra")).toBeUndefined();
    });

    it("should handle resource IDs with special characters", () => {
        expect(parseScopedPermission("view:docs:site_123-abc")).toEqual({
            permission: "view",
            resourceType: "docs",
            resourceId: "site_123-abc"
        });
    });
});

describe("createScopedPermission", () => {
    it("should create valid scoped permission strings", () => {
        expect(createScopedPermission("view", "docs", "site-123")).toBe("view:docs:site-123");
        expect(createScopedPermission("edit", "docs", "my-site")).toBe("edit:docs:my-site");
    });
});

describe("hasResourcePermission", () => {
    const userId = "test-user-123";
    const orgId = "test-org-456";

    describe("org-level permissions cascade to resources", () => {
        it("should grant access when user has org-level permission", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["view"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "site-123"
                })
            ).toBe(true);
        });

        it("should grant access to any resource with org-level permission", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["edit"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-a"
                })
            ).toBe(true);
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["edit"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-b"
                })
            ).toBe(true);
        });

        it("should grant super-user access to all resources", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["super-user"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "any-site"
                })
            ).toBe(true);
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["super-user"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "any-site"
                })
            ).toBe(true);
        });
    });

    describe("scoped permissions", () => {
        it("should grant access when user has scoped permission for specific resource", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "site-123"
                })
            ).toBe(true);
        });

        it("should deny access when user has scoped permission for different resource", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "site-456"
                })
            ).toBe(false);
        });

        it("should deny access when user has different permission type for resource", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-123"
                })
            ).toBe(false);
        });

        it("should work with multiple scoped permissions", async () => {
            const sessionPermissions = ["view:docs:site-a", "edit:docs:site-b", "view:docs:site-c"];

            expect(
                await hasResourcePermission({
                    sessionPermissions,
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "site-a"
                })
            ).toBe(true);

            expect(
                await hasResourcePermission({
                    sessionPermissions,
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-b"
                })
            ).toBe(true);

            expect(
                await hasResourcePermission({
                    sessionPermissions,
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-a"
                })
            ).toBe(false);
        });
    });

    describe("mixed org-level and scoped permissions", () => {
        it("should prioritize org-level permission over scoped", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["view", "edit:docs:site-123"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "site-456"
                })
            ).toBe(true);
        });

        it("should fall back to scoped when org-level is insufficient", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: ["cli", "edit:docs:site-123"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-123"
                })
            ).toBe(true);

            expect(
                await hasResourcePermission({
                    sessionPermissions: ["cli", "edit:docs:site-123"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs",
                    resourceId: "site-456"
                })
            ).toBe(false);
        });
    });

    describe("no permissions", () => {
        it("should deny access with empty permissions", async () => {
            expect(
                await hasResourcePermission({
                    sessionPermissions: [],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs",
                    resourceId: "site-123"
                })
            ).toBe(false);
        });
    });
});

describe("getPermittedResourceIds", () => {
    const userId = "test-user-123";
    const orgId = "test-org-456";

    describe("org-level permissions", () => {
        it("should return 'all' when user has org-level permission", async () => {
            expect(
                await getPermittedResourceIds({
                    sessionPermissions: ["view"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs"
                })
            ).toEqual({ type: "all" });
        });

        it("should return 'all' for super-user", async () => {
            expect(
                await getPermittedResourceIds({
                    sessionPermissions: ["super-user"],
                    userId,
                    orgId,
                    permissionToCheck: "edit",
                    resourceType: "docs"
                })
            ).toEqual({ type: "all" });
        });
    });

    describe("scoped permissions", () => {
        it("should return specific resource IDs when only scoped permissions exist", async () => {
            expect(
                await getPermittedResourceIds({
                    sessionPermissions: ["view:docs:site-a", "view:docs:site-b"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs"
                })
            ).toEqual({ type: "specific", resourceIds: ["site-a", "site-b"] });
        });

        it("should filter by permission type", async () => {
            expect(
                await getPermittedResourceIds({
                    sessionPermissions: ["view:docs:site-a", "edit:docs:site-b"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs"
                })
            ).toEqual({ type: "specific", resourceIds: ["site-a"] });
        });

        it("should return empty array when no matching scoped permissions", async () => {
            expect(
                await getPermittedResourceIds({
                    sessionPermissions: ["edit:docs:site-a"],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs"
                })
            ).toEqual({ type: "specific", resourceIds: [] });
        });

        it("should return empty array for empty permissions", async () => {
            expect(
                await getPermittedResourceIds({
                    sessionPermissions: [],
                    userId,
                    orgId,
                    permissionToCheck: "view",
                    resourceType: "docs"
                })
            ).toEqual({ type: "specific", resourceIds: [] });
        });
    });
});

describe("hasRoutePermission", () => {
    const userId = "test-user-123";
    const orgId = "test-org-456";

    describe("org-level route permissions", () => {
        const routeConfigs: RoutePermissionConfig[] = [
            { pattern: /^\/settings/, requiredPermission: "manage-settings" },
            { pattern: /^\/users/, requiredPermission: "manage-users" },
            { pattern: /^\/edit/, requiredPermission: "edit" }
        ];

        it("should allow access when user has required permission", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/settings/general",
                    sessionPermissions: ["manage-settings"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({ allowed: true, requiredPermission: "manage-settings" });
        });

        it("should deny access when user lacks required permission", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/settings/general",
                    sessionPermissions: ["view"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({ allowed: false, requiredPermission: "manage-settings" });
        });

        it("should allow access to unprotected routes", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/public/page",
                    sessionPermissions: [],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({ allowed: true });
        });

        it("should allow super-user access to all routes", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/settings/general",
                    sessionPermissions: ["super-user"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({ allowed: true, requiredPermission: "manage-settings" });
        });
    });

    describe("resource-scoped route permissions", () => {
        const routeConfigs: RoutePermissionConfig[] = [
            {
                pattern: /^\/docs\/([^/]+)\/edit/,
                requiredPermission: "edit",
                resourceScope: {
                    resourceType: "docs",
                    captureGroup: 1
                }
            },
            {
                pattern: /^\/docs\/([^/]+)\/view/,
                requiredPermission: "view",
                resourceScope: {
                    resourceType: "docs",
                    captureGroup: 1
                }
            },
            {
                pattern: /^\/docs\/([^/]+)/,
                requiredPermission: "view",
                resourceScope: {
                    resourceType: "docs",
                    captureGroup: 1
                }
            }
        ];

        it("should allow access with org-level permission (cascades to all resources)", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-123/edit",
                    sessionPermissions: ["edit"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: true,
                requiredPermission: "edit",
                resourceId: "site-123"
            });
        });

        it("should allow access with matching scoped permission", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-123/view",
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: true,
                requiredPermission: "view",
                resourceId: "site-123"
            });
        });

        it("should deny access when scoped permission is for different resource", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-123/view",
                    sessionPermissions: ["view:docs:site-456"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: false,
                requiredPermission: "view",
                resourceId: "site-123"
            });
        });

        it("should deny access when user has wrong permission type for resource", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-123/edit",
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: false,
                requiredPermission: "edit",
                resourceId: "site-123"
            });
        });

        it("should allow super-user access to any resource route", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/docs/any-site/edit",
                    sessionPermissions: ["super-user"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: true,
                requiredPermission: "edit",
                resourceId: "any-site"
            });
        });

        it("should extract resource ID from pathname using capture group", async () => {
            const result = await hasRoutePermission({
                pathname: "/docs/my-documentation-site/view",
                sessionPermissions: ["view:docs:my-documentation-site"],
                userId,
                orgId,
                routeConfigs
            });

            expect(result.resourceId).toBe("my-documentation-site");
            expect(result.allowed).toBe(true);
        });

        it("should work with multiple scoped permissions", async () => {
            const sessionPermissions = ["view:docs:site-a", "edit:docs:site-b", "view:docs:site-c"];

            // Can view site-a
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-a/view",
                    sessionPermissions,
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: true,
                requiredPermission: "view",
                resourceId: "site-a"
            });

            // Can edit site-b
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-b/edit",
                    sessionPermissions,
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: true,
                requiredPermission: "edit",
                resourceId: "site-b"
            });

            // Cannot edit site-a (only has view)
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-a/edit",
                    sessionPermissions,
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: false,
                requiredPermission: "edit",
                resourceId: "site-a"
            });

            // Cannot view site-d (no permission)
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-d/view",
                    sessionPermissions,
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: false,
                requiredPermission: "view",
                resourceId: "site-d"
            });
        });
    });

    describe("mixed org-level and resource-scoped routes", () => {
        const routeConfigs: RoutePermissionConfig[] = [
            // Org-level route (no resource scope)
            { pattern: /^\/settings/, requiredPermission: "manage-settings" },
            // Resource-scoped route
            {
                pattern: /^\/docs\/([^/]+)/,
                requiredPermission: "view",
                resourceScope: {
                    resourceType: "docs",
                    captureGroup: 1
                }
            }
        ];

        it("should handle org-level routes normally", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/settings/general",
                    sessionPermissions: ["manage-settings"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({ allowed: true, requiredPermission: "manage-settings" });
        });

        it("should handle resource-scoped routes with scoped permissions", async () => {
            expect(
                await hasRoutePermission({
                    pathname: "/docs/site-123",
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({
                allowed: true,
                requiredPermission: "view",
                resourceId: "site-123"
            });
        });

        it("should not leak scoped permissions to org-level routes", async () => {
            // User only has scoped view permission, not manage-settings
            expect(
                await hasRoutePermission({
                    pathname: "/settings/general",
                    sessionPermissions: ["view:docs:site-123"],
                    userId,
                    orgId,
                    routeConfigs
                })
            ).toEqual({ allowed: false, requiredPermission: "manage-settings" });
        });
    });
});

describe("hasFineGrainPermission", () => {
    it("should return true when session has app:fine_grain permission", () => {
        expect(hasFineGrainPermission([FINE_GRAIN_PERMISSION])).toBe(true);
        expect(hasFineGrainPermission(["view", FINE_GRAIN_PERMISSION, "edit"])).toBe(true);
    });

    it("should return false when session lacks app:fine_grain permission", () => {
        expect(hasFineGrainPermission([])).toBe(false);
        expect(hasFineGrainPermission(["view", "edit"])).toBe(false);
    });
});

describe("fine-grained permissions (Supabase integration)", () => {
    const userId = "test-user-123";
    const orgId = "test-org-456";

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("hasResourcePermission with fine-grained enabled", () => {
        it("should call Supabase when app:fine_grain is present and no org-level permission", async () => {
            const mockHasUserPermission = vi
                .spyOn(resourcePermissions, "hasUserPermissionForResource")
                .mockResolvedValue(true);

            const result = await hasResourcePermission({
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                permissionToCheck: "edit",
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toBe(true);
            expect(mockHasUserPermission).toHaveBeenCalledWith({
                userId,
                orgId,
                resourceType: "docs",
                resourceId: "site-123",
                permission: "edit"
            });
        });

        it("should return false when Supabase returns no permission", async () => {
            vi.spyOn(resourcePermissions, "hasUserPermissionForResource").mockResolvedValue(false);

            const result = await hasResourcePermission({
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                permissionToCheck: "edit",
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toBe(false);
        });

        it("should skip Supabase when user has org-level permission", async () => {
            const mockHasUserPermission = vi.spyOn(resourcePermissions, "hasUserPermissionForResource");

            const result = await hasResourcePermission({
                sessionPermissions: [FINE_GRAIN_PERMISSION, "edit"],
                userId,
                orgId,
                permissionToCheck: "edit",
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toBe(true);
            expect(mockHasUserPermission).not.toHaveBeenCalled();
        });

        it("should skip Supabase when user is super-user", async () => {
            const mockHasUserPermission = vi.spyOn(resourcePermissions, "hasUserPermissionForResource");

            const result = await hasResourcePermission({
                sessionPermissions: [FINE_GRAIN_PERMISSION, "super-user"],
                userId,
                orgId,
                permissionToCheck: "edit",
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toBe(true);
            expect(mockHasUserPermission).not.toHaveBeenCalled();
        });
    });

    describe("getPermittedResourceIds with fine-grained enabled", () => {
        it("should query Supabase for accessible resources when app:fine_grain is present", async () => {
            vi.spyOn(resourcePermissions, "getUserAccessibleResources").mockResolvedValue([
                "site-a",
                "site-b",
                "site-c"
            ]);
            vi.spyOn(resourcePermissions, "getAllRolePermissions").mockResolvedValue([
                { id: 1, role: "admin", permission: "edit" },
                { id: 2, role: "admin", permission: "view" },
                { id: 3, role: "viewer", permission: "view" }
            ]);
            vi.spyOn(resourcePermissions, "getUserRolesForResource").mockImplementation(async ({ resourceId }) => {
                if (resourceId === "site-a") {
                    return [
                        {
                            id: "1",
                            org_id: orgId,
                            user_id: userId,
                            resource_type: "docs",
                            resource_id: "site-a",
                            role: "admin" as const
                        }
                    ];
                }
                if (resourceId === "site-b") {
                    return [
                        {
                            id: "2",
                            org_id: orgId,
                            user_id: userId,
                            resource_type: "docs",
                            resource_id: "site-b",
                            role: "viewer" as const
                        }
                    ];
                }
                return [];
            });

            const result = await getPermittedResourceIds({
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                permissionToCheck: "edit",
                resourceType: "docs"
            });

            expect(result).toEqual({ type: "specific", resourceIds: ["site-a"] });
        });

        it("should return all resources with view permission for READER and ADMIN roles", async () => {
            vi.spyOn(resourcePermissions, "getUserAccessibleResources").mockResolvedValue(["site-a", "site-b"]);
            vi.spyOn(resourcePermissions, "getAllRolePermissions").mockResolvedValue([
                { id: 1, role: "admin", permission: "view" },
                { id: 2, role: "viewer", permission: "view" }
            ]);
            vi.spyOn(resourcePermissions, "getUserRolesForResource").mockImplementation(async ({ resourceId }) => {
                if (resourceId === "site-a") {
                    return [
                        {
                            id: "1",
                            org_id: orgId,
                            user_id: userId,
                            resource_type: "docs",
                            resource_id: "site-a",
                            role: "admin" as const
                        }
                    ];
                }
                if (resourceId === "site-b") {
                    return [
                        {
                            id: "2",
                            org_id: orgId,
                            user_id: userId,
                            resource_type: "docs",
                            resource_id: "site-b",
                            role: "viewer" as const
                        }
                    ];
                }
                return [];
            });

            const result = await getPermittedResourceIds({
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                permissionToCheck: "view",
                resourceType: "docs"
            });

            expect(result).toEqual({ type: "specific", resourceIds: ["site-a", "site-b"] });
        });

        it("should return 'all' when user has org-level permission even with app:fine_grain", async () => {
            const mockGetAccessible = vi.spyOn(resourcePermissions, "getUserAccessibleResources");

            const result = await getPermittedResourceIds({
                sessionPermissions: [FINE_GRAIN_PERMISSION, "view"],
                userId,
                orgId,
                permissionToCheck: "view",
                resourceType: "docs"
            });

            expect(result).toEqual({ type: "all" });
            expect(mockGetAccessible).not.toHaveBeenCalled();
        });
    });

    describe("getResourcePermissions with fine-grained enabled", () => {
        it("should query Supabase for resource permissions when app:fine_grain is present", async () => {
            vi.spyOn(resourcePermissions, "getUserPermissionsForResource").mockResolvedValue(["view", "edit"]);

            const result = await getResourcePermissions({
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toEqual(["view", "edit"]);
        });

        it("should combine org-level and Supabase permissions", async () => {
            vi.spyOn(resourcePermissions, "getUserPermissionsForResource").mockResolvedValue(["edit"]);

            const result = await getResourcePermissions({
                sessionPermissions: [FINE_GRAIN_PERMISSION, "view"],
                userId,
                orgId,
                resourceType: "docs",
                resourceId: "site-123"
            });

            // Should have both org-level "view" and Supabase "edit"
            expect(result).toContain("view");
            expect(result).toContain("edit");
        });

        it("should return all permissions for super-user without querying Supabase", async () => {
            const mockGetPermissions = vi.spyOn(resourcePermissions, "getUserPermissionsForResource");

            const result = await getResourcePermissions({
                sessionPermissions: [FINE_GRAIN_PERMISSION, "super-user"],
                userId,
                orgId,
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toContain("view");
            expect(result).toContain("edit");
            expect(result).toContain("manage-users");
            expect(result).toContain("manage-settings");
            expect(mockGetPermissions).not.toHaveBeenCalled();
        });

        it("should filter out invalid permissions from Supabase", async () => {
            vi.spyOn(resourcePermissions, "getUserPermissionsForResource").mockResolvedValue([
                "view",
                "invalid-permission",
                "edit"
            ]);

            const result = await getResourcePermissions({
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                resourceType: "docs",
                resourceId: "site-123"
            });

            expect(result).toEqual(["view", "edit"]);
            expect(result).not.toContain("invalid-permission");
        });
    });

    describe("hasRoutePermission with fine-grained enabled", () => {
        const routeConfigs: RoutePermissionConfig[] = [
            {
                pattern: /^\/docs\/([^/]+)\/edit/,
                requiredPermission: "edit",
                resourceScope: {
                    resourceType: "docs",
                    captureGroup: 1
                }
            }
        ];

        it("should use Supabase for route permission check when app:fine_grain is present", async () => {
            vi.spyOn(resourcePermissions, "hasUserPermissionForResource").mockResolvedValue(true);

            const result = await hasRoutePermission({
                pathname: "/docs/site-123/edit",
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                routeConfigs
            });

            expect(result).toEqual({
                allowed: true,
                requiredPermission: "edit",
                resourceId: "site-123"
            });
        });

        it("should deny access when Supabase returns no permission for route", async () => {
            vi.spyOn(resourcePermissions, "hasUserPermissionForResource").mockResolvedValue(false);

            const result = await hasRoutePermission({
                pathname: "/docs/site-123/edit",
                sessionPermissions: [FINE_GRAIN_PERMISSION],
                userId,
                orgId,
                routeConfigs
            });

            expect(result).toEqual({
                allowed: false,
                requiredPermission: "edit",
                resourceId: "site-123"
            });
        });
    });
});
