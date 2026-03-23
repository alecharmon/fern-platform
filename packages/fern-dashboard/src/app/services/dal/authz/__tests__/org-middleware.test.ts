import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName } from "@/app/services/auth0/types";

// Mock external dependencies
vi.mock("@fern-api/user-permissions", () => ({
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

import { getPermissionsFromSession, hasPermission } from "@fern-api/user-permissions";
import { maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { withOrgPermissions } from "../org-middleware";

const mockMaybeGetCurrentSession = maybeGetCurrentSession as Mock;
const mockGetOrgIdFromName = getOrgIdFromName as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;
const mockGetPermissionsFromSession = getPermissionsFromSession as Mock;
const mockHasPermission = hasPermission as Mock;

function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        body: JSON.stringify(body)
    });
}

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

describe("withOrgPermissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMaybeGetCurrentSession.mockResolvedValue({ data: sessionData });
        mockGetOrgIdFromName.mockResolvedValue(orgId);
        mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
        mockGetPermissionsFromSession.mockReturnValue(["manage-settings"]);
        mockHasPermission.mockReturnValue(true);
    });

    it("calls handler with session and orgId on success", async () => {
        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrapped = withOrgPermissions(["manage-settings"], handler);

        const req = makeRequest({ orgName });
        const res = await wrapped(req, { orgName });

        expect(handler).toHaveBeenCalledWith(req, { orgName }, expect.objectContaining({ orgId }));
        expect(res.status).toBe(200);
    });

    it("returns 401 when session is invalid", async () => {
        mockMaybeGetCurrentSession.mockResolvedValue({
            errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        });

        const handler = vi.fn();
        const wrapped = withOrgPermissions(["manage-settings"], handler);
        const res = await wrapped(makeRequest({ orgName }), { orgName });

        expect(res.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it("returns 403 when user is not in org", async () => {
        mockAssertUserHasOrganizationAccess.mockRejectedValue(new Error("Not a member"));

        const handler = vi.fn();
        const wrapped = withOrgPermissions(["manage-settings"], handler);
        const res = await wrapped(makeRequest({ orgName }), { orgName });

        expect(res.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
    });

    it("returns 403 when user lacks required permission", async () => {
        mockHasPermission.mockReturnValue(false);

        const handler = vi.fn();
        const wrapped = withOrgPermissions(["manage-settings"], handler);
        const res = await wrapped(makeRequest({ orgName }), { orgName });

        expect(res.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
    });

    it("resolves orgId from orgName when not in session", async () => {
        mockMaybeGetCurrentSession.mockResolvedValue({
            data: { ...sessionData, orgId: null }
        });

        const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
        const wrapped = withOrgPermissions(["manage-settings"], handler);
        await wrapped(makeRequest({ orgName }), { orgName });

        expect(mockGetOrgIdFromName).toHaveBeenCalledWith(orgName);
        expect(handler).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ orgId }));
    });

    it("returns 404 when org resolution fails", async () => {
        mockMaybeGetCurrentSession.mockResolvedValue({
            data: { ...sessionData, orgId: null }
        });
        mockGetOrgIdFromName.mockRejectedValue(new Error("Not found"));

        const handler = vi.fn();
        const wrapped = withOrgPermissions(["manage-settings"], handler);
        const res = await wrapped(makeRequest({ orgName }), { orgName });

        expect(res.status).toBe(404);
        expect(handler).not.toHaveBeenCalled();
    });

    it("checks all required permissions", async () => {
        mockHasPermission.mockImplementation((_perms: string[], perm: string) => perm !== "manage-users");

        const handler = vi.fn();
        const wrapped = withOrgPermissions(["manage-settings", "manage-users"], handler);
        const res = await wrapped(makeRequest({ orgName }), { orgName });

        expect(res.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
    });
});
