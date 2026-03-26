import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName } from "@/app/services/auth0/types";

vi.mock("@fern-api/user-permissions", () => ({
    deleteOidcGroupMapping: vi.fn(),
    listOidcGroupMappings: vi.fn(),
    getPermissionsFromSession: vi.fn(),
    hasPermission: vi.fn()
}));

vi.mock("@/app/api/utils/maybeGetCurrentSession", () => ({
    maybeGetCurrentSession: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    getOrgIdFromName: vi.fn(),
    getOrgMembers: vi.fn()
}));

vi.mock("@/app/services/dal/organization", () => ({
    assertUserHasOrganizationAccess: vi.fn()
}));

vi.mock("@/app/services/redis/redis", () => ({
    redisSet: vi.fn()
}));

vi.mock("@/app/services/redis/cacheKey", () => ({
    RedisCacheKey: {
        userSessionInvalidated: (userId: string) => `user-session-invalidated-${userId}`
    }
}));

import {
    deleteOidcGroupMapping,
    getPermissionsFromSession,
    hasPermission,
    listOidcGroupMappings
} from "@fern-api/user-permissions";
import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgMembers } from "@/app/services/auth0/management";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { redisSet } from "@/app/services/redis/redis";

const mockDeleteOidcGroupMapping = deleteOidcGroupMapping as Mock;
const mockListOidcGroupMappings = listOidcGroupMappings as Mock;
const mockMaybeGetCurrentSession = maybeGetCurrentSession as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;
const mockGetPermissionsFromSession = getPermissionsFromSession as Mock;
const mockHasPermission = hasPermission as Mock;
const mockGetOrgMembers = getOrgMembers as Mock;
const mockRedisSet = redisSet as Mock;

const orgName = "test-org" as Auth0OrgName;
const orgId = "org_123";
const mappingId = "550e8400-e29b-41d4-a716-446655440000";

const sessionData = {
    token: "test-token",
    userId: "auth0|user-1",
    orgId,
    permissions: ["manage-settings"],
    name: "Test User",
    email: "test@example.com"
};

describe("oidc-group-mappings/delete", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMaybeGetCurrentSession.mockResolvedValue({ data: sessionData });
        mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
        mockGetPermissionsFromSession.mockReturnValue(["manage-settings"]);
        mockHasPermission.mockReturnValue(true);
        mockGetOrgMembers.mockResolvedValue([{ user_id: "auth0|user-1" }]);
        mockRedisSet.mockResolvedValue(undefined);
        mockDeleteOidcGroupMapping.mockResolvedValue(undefined);
        mockListOidcGroupMappings.mockResolvedValue([
            { id: mappingId, orgId, connectionName: "oidc-okta", groupId: "eng" }
        ]);
    });

    let POST: typeof import("../delete/route").POST;
    beforeEach(async () => {
        const mod = await import("../delete/route");
        POST = mod.POST;
    });

    it("deletes a mapping that belongs to the org", async () => {
        const req = new Request("http://localhost:3000/api/oidc-group-mappings/delete", {
            method: "POST",
            body: JSON.stringify({ orgName, mappingId }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(mockDeleteOidcGroupMapping).toHaveBeenCalledWith(mappingId);
    });

    it("returns 404 when mapping does not belong to org", async () => {
        mockListOidcGroupMappings.mockResolvedValue([]);

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/delete", {
            method: "POST",
            body: JSON.stringify({ orgName, mappingId }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(404);
        expect(mockDeleteOidcGroupMapping).not.toHaveBeenCalled();
    });

    it("rejects invalid UUID for mappingId", async () => {
        const req = new Request("http://localhost:3000/api/oidc-group-mappings/delete", {
            method: "POST",
            body: JSON.stringify({ orgName, mappingId: "not-a-uuid" }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(400);
        expect(mockDeleteOidcGroupMapping).not.toHaveBeenCalled();
    });

    it("invalidates org member sessions except current user after deletion", async () => {
        mockGetOrgMembers.mockResolvedValue([{ user_id: "auth0|user-1" }, { user_id: "auth0|user-2" }]);

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/delete", {
            method: "POST",
            body: JSON.stringify({ orgName, mappingId }),
            headers: { "Content-Type": "application/json" }
        });

        await POST(req as any);

        // Current user (auth0|user-1) is excluded from invalidation
        expect(mockRedisSet).toHaveBeenCalledTimes(1);
        expect(mockRedisSet).toHaveBeenCalledWith("user-session-invalidated-auth0|user-2", true, expect.any(Object));
    });

    it("returns 500 when deleteOidcGroupMapping throws", async () => {
        mockDeleteOidcGroupMapping.mockRejectedValue(new Error("Supabase error"));

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/delete", {
            method: "POST",
            body: JSON.stringify({ orgName, mappingId }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(500);
    });
});
