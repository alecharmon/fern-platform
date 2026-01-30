import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the client module before importing the module under test
vi.mock("./client", () => ({
    getManagementClient: vi.fn(),
    getManagementClientResult: vi.fn()
}));

vi.mock("./resource-permissions", () => ({
    getClientResult: vi.fn(),
    addUserRoleForResourceResult: vi.fn(),
    getUserRolesResult: vi.fn(),
    removeAllUserRolesForResourceResult: vi.fn()
}));

vi.mock("./roles", () => ({
    addRolesResult: vi.fn(),
    removeRolesResult: vi.fn()
}));

import { ok, okAsync } from "neverthrow";
import { getManagementClient, getManagementClientResult } from "./client";
import { getOidcGroups, getOidcGroupsResult, syncOidcPermissionsResult } from "./oidc-permissions";
import {
    addUserRoleForResourceResult,
    getClientResult,
    removeAllUserRolesForResourceResult
} from "./resource-permissions";
import { addRolesResult, removeRolesResult } from "./roles";

describe("getOidcGroups", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return oidc-groups array when present in app_metadata", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        app_metadata: {
                            "oidc-groups": ["group-1", "group-2", "group-3"]
                        }
                    }
                })
            }
        };
        vi.mocked(getManagementClient).mockReturnValue(mockClient as any);

        const result = await getOidcGroups("user-123");

        expect(result).toEqual(["group-1", "group-2", "group-3"]);
        expect(mockClient.users.get).toHaveBeenCalledWith({ id: "user-123" });
    });

    it("should return null when oidc-groups is not present", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        app_metadata: {}
                    }
                })
            }
        };
        vi.mocked(getManagementClient).mockReturnValue(mockClient as any);

        const result = await getOidcGroups("user-123");

        expect(result).toBeNull();
    });

    it("should return null when app_metadata is undefined", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {}
                })
            }
        };
        vi.mocked(getManagementClient).mockReturnValue(mockClient as any);

        const result = await getOidcGroups("user-123");

        expect(result).toBeNull();
    });

    it("should filter out non-string values from oidc-groups", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        app_metadata: {
                            "oidc-groups": ["group-1", 123, null, "group-2", undefined]
                        }
                    }
                })
            }
        };
        vi.mocked(getManagementClient).mockReturnValue(mockClient as any);

        const result = await getOidcGroups("user-123");

        expect(result).toEqual(["group-1", "group-2"]);
    });

    it("should return null when oidc-groups is not an array", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        app_metadata: {
                            "oidc-groups": "not-an-array"
                        }
                    }
                })
            }
        };
        vi.mocked(getManagementClient).mockReturnValue(mockClient as any);

        const result = await getOidcGroups("user-123");

        expect(result).toBeNull();
    });
});

describe("getOidcGroupsResult", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return ok with groups when present", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        groups: ["group-1", "group-2"]
                    }
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockClient as any));

        const result = await getOidcGroupsResult("user-123");

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(["group-1", "group-2"]);
        }
    });

    it("should return ok with null when groups not present", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {}
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockClient as any));

        const result = await getOidcGroupsResult("user-123");

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBeNull();
        }
    });
});

describe("getOidcGroupMappings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return empty array when groupIds is empty", async () => {
        const { getOidcGroupMappings } = await import("./oidc-permissions");
        const result = await getOidcGroupMappings("org-123", "oidcnvidia", []);
        expect(result).toEqual([]);
    });

    it("should return mappings for matching groups", async () => {
        const mockData = [
            {
                id: "mapping-1",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "group-1",
                mapping_type: "org_role",
                role: "admin",
                resource_type: null,
                resource_id: null,
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            }
        ];

        const mockClient = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({ data: mockData, error: null })
                        })
                    })
                })
            })
        };
        vi.mocked(getClientResult).mockReturnValue(ok(mockClient as any));

        const { getOidcGroupMappings } = await import("./oidc-permissions");
        const result = await getOidcGroupMappings("org-123", "oidcnvidia", ["group-1"]);

        expect(result).toHaveLength(1);
        expect(result[0]!.orgId).toBe("org-123");
        expect(result[0]!.role).toBe("admin");
        expect(result[0]!.mappingType).toBe("org_role");
    });
});

describe("listOidcGroupMappings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return all mappings for an org", async () => {
        const mockData = [
            {
                id: "mapping-1",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "group-1",
                mapping_type: "org_role",
                role: "admin",
                resource_type: null,
                resource_id: null,
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            },
            {
                id: "mapping-2",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "group-2",
                mapping_type: "resource_role",
                role: "editor",
                resource_type: "docs",
                resource_id: "site-abc",
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: "user-456"
            }
        ];

        const mockClient = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: mockData, error: null })
                    })
                })
            })
        };
        vi.mocked(getClientResult).mockReturnValue(ok(mockClient as any));

        const { listOidcGroupMappings } = await import("./oidc-permissions");
        const result = await listOidcGroupMappings("org-123");

        expect(result).toHaveLength(2);
        expect(result[0]!.mappingType).toBe("org_role");
        expect(result[1]!.mappingType).toBe("resource_role");
        expect(result[1]!.resourceType).toBe("docs");
    });
});

describe("syncOidcPermissionsResult", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return no_oidc_groups when user has no OIDC groups", async () => {
        const mockClient = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {}
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockClient as any));

        const result = await syncOidcPermissionsResult({
            userId: "user-123",
            orgId: "org-123",
            connectionName: "oidcnvidia"
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ synced: false, reason: "no_oidc_groups" });
        }
    });

    it("should return no_mappings when no mappings exist for user's groups", async () => {
        // Mock Auth0 client to return user with OIDC groups
        const mockAuth0Client = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        groups: ["group-1", "group-2"]
                    }
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockAuth0Client as any));

        // Mock Supabase client to return no mappings
        const mockSupabaseClient = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({ data: [], error: null })
                        })
                    })
                })
            })
        };
        vi.mocked(getClientResult).mockReturnValue(ok(mockSupabaseClient as any));

        const result = await syncOidcPermissionsResult({
            userId: "user-123",
            orgId: "org-123",
            connectionName: "oidcnvidia"
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ synced: false, reason: "no_mappings" });
        }
    });

    it("should apply org-level role from mappings", async () => {
        // Mock Auth0 client
        const mockAuth0Client = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        groups: ["engineering"]
                    }
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockAuth0Client as any));

        // Mock Supabase client to return org-level mapping
        const mockMappings = [
            {
                id: "mapping-1",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "engineering",
                mapping_type: "org_role",
                role: "editor",
                resource_type: null,
                resource_id: null,
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            }
        ];
        const mockSupabaseClient = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({ data: mockMappings, error: null })
                        })
                    })
                })
            })
        };
        vi.mocked(getClientResult).mockReturnValue(ok(mockSupabaseClient as any));

        // Mock roles functions
        vi.mocked(removeRolesResult).mockReturnValue(okAsync({ ok: true } as any));
        vi.mocked(addRolesResult).mockReturnValue(okAsync({ ok: true } as any));

        const result = await syncOidcPermissionsResult({
            userId: "user-123",
            orgId: "org-123",
            connectionName: "oidcnvidia"
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.synced).toBe(true);
            if (result.value.synced) {
                expect(result.value.changes.added).toContain("org:editor");
            }
        }

        // Verify removeRolesResult was called to remove non-target roles
        expect(removeRolesResult).toHaveBeenCalledWith({
            userId: "user-123",
            orgId: "org-123",
            roleNames: ["admin", "viewer"]
        });

        // Verify addRolesResult was called with the target role
        expect(addRolesResult).toHaveBeenCalledWith({
            userId: "user-123",
            orgId: "org-123",
            roleNames: ["editor"]
        });
    });

    it("should apply highest privilege role when user is in multiple groups", async () => {
        // Mock Auth0 client
        const mockAuth0Client = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        groups: ["viewers", "editors", "admins"]
                    }
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockAuth0Client as any));

        // Mock Supabase client to return multiple org-level mappings
        const mockMappings = [
            {
                id: "mapping-1",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "viewers",
                mapping_type: "org_role",
                role: "viewer",
                resource_type: null,
                resource_id: null,
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            },
            {
                id: "mapping-2",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "editors",
                mapping_type: "org_role",
                role: "editor",
                resource_type: null,
                resource_id: null,
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            },
            {
                id: "mapping-3",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "admins",
                mapping_type: "org_role",
                role: "admin",
                resource_type: null,
                resource_id: null,
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            }
        ];
        const mockSupabaseClient = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({ data: mockMappings, error: null })
                        })
                    })
                })
            })
        };
        vi.mocked(getClientResult).mockReturnValue(ok(mockSupabaseClient as any));

        // Mock roles functions
        vi.mocked(removeRolesResult).mockReturnValue(okAsync({ ok: true } as any));
        vi.mocked(addRolesResult).mockReturnValue(okAsync({ ok: true } as any));

        const result = await syncOidcPermissionsResult({
            userId: "user-123",
            orgId: "org-123",
            connectionName: "oidcnvidia"
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.synced).toBe(true);
            if (result.value.synced) {
                // Should get admin (highest privilege)
                expect(result.value.changes.added).toContain("org:admin");
            }
        }

        // Verify addRolesResult was called with admin (highest privilege)
        expect(addRolesResult).toHaveBeenCalledWith({
            userId: "user-123",
            orgId: "org-123",
            roleNames: ["admin"]
        });
    });

    it("should apply resource-level roles from mappings", async () => {
        // Mock Auth0 client
        const mockAuth0Client = {
            users: {
                get: vi.fn().mockResolvedValue({
                    data: {
                        groups: ["docs-editors"]
                    }
                })
            }
        };
        vi.mocked(getManagementClientResult).mockReturnValue(ok(mockAuth0Client as any));

        // Mock Supabase client to return resource-level mapping
        const mockMappings = [
            {
                id: "mapping-1",
                org_id: "org-123",
                connection_name: "oidcnvidia",
                group_id: "docs-editors",
                mapping_type: "resource_role",
                role: "editor",
                resource_type: "docs",
                resource_id: "site-abc",
                created_at: "2026-01-27T00:00:00Z",
                updated_at: "2026-01-27T00:00:00Z",
                created_by: null
            }
        ];
        const mockSupabaseClient = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({ data: mockMappings, error: null })
                        })
                    })
                })
            })
        };
        vi.mocked(getClientResult).mockReturnValue(ok(mockSupabaseClient as any));

        // Mock resource permission functions
        vi.mocked(removeAllUserRolesForResourceResult).mockReturnValue(okAsync(undefined));
        vi.mocked(addUserRoleForResourceResult).mockReturnValue(okAsync({} as any));

        const result = await syncOidcPermissionsResult({
            userId: "user-123",
            orgId: "org-123",
            connectionName: "oidcnvidia"
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.synced).toBe(true);
            if (result.value.synced) {
                expect(result.value.changes.added).toContain("docs:site-abc:editor");
            }
        }

        // Verify resource role functions were called
        expect(removeAllUserRolesForResourceResult).toHaveBeenCalledWith({
            orgId: "org-123",
            userId: "user-123",
            resourceType: "docs",
            resourceId: "site-abc"
        });
        expect(addUserRoleForResourceResult).toHaveBeenCalledWith({
            org_id: "org-123",
            user_id: "user-123",
            resource_type: "docs",
            resource_id: "site-abc",
            role: "editor"
        });
    });
});
