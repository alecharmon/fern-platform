import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName } from "@/app/services/auth0/types";

vi.mock("@fern-api/user-permissions", () => ({
    createOidcGroupMapping: vi.fn(),
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

import { createOidcGroupMapping, getPermissionsFromSession, hasPermission } from "@fern-api/user-permissions";
import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgMembers } from "@/app/services/auth0/management";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { redisSet } from "@/app/services/redis/redis";

const mockCreateOidcGroupMapping = createOidcGroupMapping as Mock;
const mockMaybeGetCurrentSession = maybeGetCurrentSession as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;
const mockGetPermissionsFromSession = getPermissionsFromSession as Mock;
const mockHasPermission = hasPermission as Mock;
const mockGetOrgMembers = getOrgMembers as Mock;
const mockRedisSet = redisSet as Mock;

const orgName = "test-org" as Auth0OrgName;
const orgId = "org_123";
const userId = "auth0|user-1";

const sessionData = {
    token: "test-token",
    userId,
    orgId,
    permissions: ["manage-settings"],
    name: "Test User",
    email: "test@example.com"
};

describe("oidc-group-mappings/create", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMaybeGetCurrentSession.mockResolvedValue({ data: sessionData });
        mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
        mockGetPermissionsFromSession.mockReturnValue(["manage-settings"]);
        mockHasPermission.mockReturnValue(true);
        mockGetOrgMembers.mockResolvedValue([{ user_id: userId }]);
        mockRedisSet.mockResolvedValue(undefined);
    });

    let POST: typeof import("../create/route").POST;
    beforeEach(async () => {
        const mod = await import("../create/route");
        POST = mod.POST;
    });

    it("creates an org_role mapping", async () => {
        const createdMapping = {
            id: "uuid-new",
            orgId,
            connectionName: "oidc-okta",
            groupId: "engineering",
            mappingType: "org_role",
            role: "editor",
            resourceType: null,
            resourceId: null,
            createdAt: "2026-03-23T00:00:00Z",
            updatedAt: "2026-03-23T00:00:00Z",
            createdBy: userId
        };
        mockCreateOidcGroupMapping.mockResolvedValue(createdMapping);

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/create", {
            method: "POST",
            body: JSON.stringify({
                orgName,
                connectionName: "oidc-okta",
                groupId: "engineering",
                mappingType: "org_role",
                role: "editor"
            }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.mapping.id).toBe("uuid-new");
        expect(mockCreateOidcGroupMapping).toHaveBeenCalledWith({
            orgId,
            connectionName: "oidc-okta",
            groupId: "engineering",
            mappingType: "org_role",
            role: "editor",
            resourceType: undefined,
            resourceId: undefined,
            createdBy: userId
        });
    });

    it("creates a resource_role mapping with resource fields", async () => {
        mockCreateOidcGroupMapping.mockResolvedValue({ id: "uuid-res" });

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/create", {
            method: "POST",
            body: JSON.stringify({
                orgName,
                connectionName: "oidc-okta",
                groupId: "devops",
                mappingType: "resource_role",
                role: "admin",
                resourceType: "docs",
                resourceId: "docs.example.com"
            }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(200);
        expect(mockCreateOidcGroupMapping).toHaveBeenCalledWith(
            expect.objectContaining({
                mappingType: "resource_role",
                resourceType: "docs",
                resourceId: "docs.example.com"
            })
        );
    });

    it("rejects resource_role without resource fields", async () => {
        const req = new Request("http://localhost:3000/api/oidc-group-mappings/create", {
            method: "POST",
            body: JSON.stringify({
                orgName,
                connectionName: "oidc-okta",
                groupId: "devops",
                mappingType: "resource_role",
                role: "admin"
            }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(400);
        expect(mockCreateOidcGroupMapping).not.toHaveBeenCalled();
    });

    it("rejects org_role with resource fields", async () => {
        const req = new Request("http://localhost:3000/api/oidc-group-mappings/create", {
            method: "POST",
            body: JSON.stringify({
                orgName,
                connectionName: "oidc-okta",
                groupId: "engineering",
                mappingType: "org_role",
                role: "editor",
                resourceType: "docs",
                resourceId: "docs.example.com"
            }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(400);
        expect(mockCreateOidcGroupMapping).not.toHaveBeenCalled();
    });

    it("invalidates all org member sessions after creation", async () => {
        mockCreateOidcGroupMapping.mockResolvedValue({ id: "uuid-new" });
        mockGetOrgMembers.mockResolvedValue([
            { user_id: "auth0|user-1" },
            { user_id: "auth0|user-2" }
        ]);

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/create", {
            method: "POST",
            body: JSON.stringify({
                orgName,
                connectionName: "oidc-okta",
                groupId: "engineering",
                mappingType: "org_role",
                role: "editor"
            }),
            headers: { "Content-Type": "application/json" }
        });

        await POST(req as any);

        expect(mockRedisSet).toHaveBeenCalledTimes(2);
    });

    it("returns 409 on duplicate mapping", async () => {
        mockCreateOidcGroupMapping.mockRejectedValue(new Error("duplicate key value violates unique constraint"));

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/create", {
            method: "POST",
            body: JSON.stringify({
                orgName,
                connectionName: "oidc-okta",
                groupId: "engineering",
                mappingType: "org_role",
                role: "editor"
            }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(409);
    });
});
