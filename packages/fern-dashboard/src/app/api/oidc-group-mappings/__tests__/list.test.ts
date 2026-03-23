import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName } from "@/app/services/auth0/types";

vi.mock("@fern-api/user-permissions", () => ({
    listOidcGroupMappings: vi.fn(),
    getPermissionsFromSession: vi.fn(),
    hasPermission: vi.fn()
}));

vi.mock("@/app/api/utils/maybeGetCurrentSession", () => ({
    maybeGetCurrentSession: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    getOrgIdFromName: vi.fn()
}));

vi.mock("@/app/services/dal/organization", () => ({
    assertUserHasOrganizationAccess: vi.fn()
}));

import { getPermissionsFromSession, hasPermission, listOidcGroupMappings } from "@fern-api/user-permissions";
import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

const mockListOidcGroupMappings = listOidcGroupMappings as Mock;
const mockMaybeGetCurrentSession = maybeGetCurrentSession as Mock;
const mockGetOrgIdFromName = getOrgIdFromName as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;
const mockGetPermissionsFromSession = getPermissionsFromSession as Mock;
const mockHasPermission = hasPermission as Mock;

const orgName = "test-org" as Auth0OrgName;
const orgId = "org_123";

const sessionData = {
    token: "test-token",
    userId: "auth0|user-1",
    orgId,
    permissions: ["manage-settings"],
    name: "Test User",
    email: "test@example.com"
};

const sampleMappings = [
    {
        id: "uuid-1",
        orgId,
        connectionName: "oidc-okta",
        groupId: "engineering",
        mappingType: "org_role",
        role: "editor",
        resourceType: null,
        resourceId: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        createdBy: "auth0|admin"
    },
    {
        id: "uuid-2",
        orgId,
        connectionName: "oidc-azure",
        groupId: "devops",
        mappingType: "resource_role",
        role: "admin",
        resourceType: "docs",
        resourceId: "docs.example.com",
        createdAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        createdBy: "auth0|admin"
    }
];

describe("oidc-group-mappings/list", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMaybeGetCurrentSession.mockResolvedValue({ data: sessionData });
        mockGetOrgIdFromName.mockResolvedValue(orgId);
        mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
        mockGetPermissionsFromSession.mockReturnValue(["manage-settings"]);
        mockHasPermission.mockReturnValue(true);
        mockListOidcGroupMappings.mockResolvedValue(sampleMappings);
    });

    let POST: typeof import("../list/route").POST;
    beforeEach(async () => {
        const mod = await import("../list/route");
        POST = mod.POST;
    });

    it("returns all mappings for org", async () => {
        const req = new Request("http://localhost:3000/api/oidc-group-mappings/list", {
            method: "POST",
            body: JSON.stringify({ orgName }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.mappings).toHaveLength(2);
        expect(mockListOidcGroupMappings).toHaveBeenCalledWith(orgId);
    });

    it("filters by connectionName when provided", async () => {
        const req = new Request("http://localhost:3000/api/oidc-group-mappings/list", {
            method: "POST",
            body: JSON.stringify({ orgName, connectionName: "oidc-okta" }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.mappings).toHaveLength(1);
        expect(json.mappings[0].connectionName).toBe("oidc-okta");
    });

    it("returns empty array when no mappings exist", async () => {
        mockListOidcGroupMappings.mockResolvedValue([]);

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/list", {
            method: "POST",
            body: JSON.stringify({ orgName }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.mappings).toHaveLength(0);
    });

    it("returns 500 when listOidcGroupMappings throws", async () => {
        mockListOidcGroupMappings.mockRejectedValue(new Error("Supabase error"));

        const req = new Request("http://localhost:3000/api/oidc-group-mappings/list", {
            method: "POST",
            body: JSON.stringify({ orgName }),
            headers: { "Content-Type": "application/json" }
        });

        const res = await POST(req as any);

        expect(res.status).toBe(500);
    });
});
