import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

import { tryAutoAssignAdminRole } from "../autoAssignAdminRole";

vi.mock("@fern-api/user-permissions", () => ({
    getRoles: vi.fn(),
    addRoles: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    getOrgIdFromName: vi.fn(),
    getOrgMembers: vi.fn(),
    createIsFernEmployee: vi.fn()
}));

import { addRoles, getRoles } from "@fern-api/user-permissions";

import * as auth0Management from "@/app/services/auth0/management";

const mockGetRoles = getRoles as Mock;
const mockAddRoles = addRoles as Mock;
const mockGetOrgIdFromName = auth0Management.getOrgIdFromName as Mock;
const mockGetOrgMembers = auth0Management.getOrgMembers as Mock;
const mockCreateIsFernEmployee = auth0Management.createIsFernEmployee as Mock;

describe("tryAutoAssignAdminRole", () => {
    const userId = "auth0|test-user" as Auth0UserID;
    const orgName = "test-org" as Auth0OrgName;
    const orgId = "org_123";

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOrgIdFromName.mockResolvedValue(orgId);
        mockGetRoles.mockResolvedValue({ data: [] });
        mockAddRoles.mockResolvedValue({ ok: true });
        mockGetOrgMembers.mockResolvedValue([{ user_id: userId }]);
        mockCreateIsFernEmployee.mockResolvedValue(() => false);
    });

    describe("when user is a Fern employee", () => {
        it("skips auto-assign and returns user_is_fern_employee reason", async () => {
            mockCreateIsFernEmployee.mockResolvedValue(() => true);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "skipped",
                reason: "user_is_fern_employee"
            });
            expect(mockAddRoles).not.toHaveBeenCalled();
        });
    });

    describe("when user already has roles", () => {
        it("skips auto-assign and returns user_has_roles reason", async () => {
            mockGetRoles.mockResolvedValue({ data: ["editor"] });

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "skipped",
                reason: "user_has_roles"
            });
            expect(mockAddRoles).not.toHaveBeenCalled();
        });
    });

    describe("when user is not the only member", () => {
        it("skips auto-assign when there are multiple members", async () => {
            mockGetOrgMembers.mockResolvedValue([{ user_id: userId }, { user_id: "auth0|other-user" }]);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "skipped",
                reason: "not_only_member"
            });
            expect(mockAddRoles).not.toHaveBeenCalled();
        });

        it("skips auto-assign when the only member is a different user", async () => {
            mockGetOrgMembers.mockResolvedValue([{ user_id: "auth0|other-user" }]);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "skipped",
                reason: "not_only_member"
            });
            expect(mockAddRoles).not.toHaveBeenCalled();
        });

        it("skips auto-assign when there are no members", async () => {
            mockGetOrgMembers.mockResolvedValue([]);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "skipped",
                reason: "not_only_member"
            });
            expect(mockAddRoles).not.toHaveBeenCalled();
        });
    });

    describe("when user is the only member without roles", () => {
        it("assigns admin role successfully", async () => {
            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({ status: "assigned" });
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId,
                orgId,
                roleNames: ["admin"]
            });
        });

        it("excludes Fern employees when checking members", async () => {
            await tryAutoAssignAdminRole({ userId, orgName });

            expect(mockGetOrgMembers).toHaveBeenCalledWith(orgName, { includeFernEmployees: false });
        });
    });

    describe("error handling", () => {
        it("returns error when addRoles fails", async () => {
            mockAddRoles.mockResolvedValue({ ok: false, status: 500 });

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "error",
                error: "Failed with status 500"
            });
        });

        it("returns error when getOrgIdFromName throws", async () => {
            const error = new Error("Org not found");
            mockGetOrgIdFromName.mockRejectedValue(error);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "error",
                error
            });
        });

        it("returns error when getRoles throws", async () => {
            const error = new Error("Auth0 error");
            mockGetRoles.mockRejectedValue(error);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "error",
                error
            });
        });

        it("returns error when getOrgMembers throws", async () => {
            const error = new Error("Failed to get members");
            mockGetOrgMembers.mockRejectedValue(error);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "error",
                error
            });
        });

        it("returns error when createIsFernEmployee throws", async () => {
            const error = new Error("Failed to check Fern employee");
            mockCreateIsFernEmployee.mockRejectedValue(error);

            const result = await tryAutoAssignAdminRole({ userId, orgName });

            expect(result).toEqual({
                status: "error",
                error
            });
        });
    });
});
