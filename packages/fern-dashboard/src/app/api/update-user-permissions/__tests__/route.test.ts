import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

import updateUserPermissionsHandler from "../handler";

// Mock all external dependencies
vi.mock("@fern-api/user-permissions", () => ({
    getRoles: vi.fn(),
    getUserRoles: vi.fn(),
    addRoles: vi.fn(),
    removeRoles: vi.fn(),
    addUserRoleForResource: vi.fn(),
    removeUserRoleForResource: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    getOrgIdFromName: vi.fn(),
    invalidateCachesAfterUpdatingMemberRoles: vi.fn()
}));

vi.mock("@/app/services/redis/redis", () => ({
    redisSet: vi.fn()
}));

// Import mocked modules
import {
    addRoles,
    addUserRoleForResource,
    getRoles,
    getUserRoles,
    removeRoles,
    removeUserRoleForResource
} from "@fern-api/user-permissions";

import * as auth0Management from "@/app/services/auth0/management";
import { redisSet } from "@/app/services/redis/redis";

const mockGetRoles = getRoles as Mock;
const mockGetUserRoles = getUserRoles as Mock;
const mockAddRoles = addRoles as Mock;
const mockRemoveRoles = removeRoles as Mock;
const mockAddUserRoleForResource = addUserRoleForResource as Mock;
const mockRemoveUserRoleForResource = removeUserRoleForResource as Mock;
const mockGetOrgIdFromName = auth0Management.getOrgIdFromName as Mock;
const mockInvalidateCaches = auth0Management.invalidateCachesAfterUpdatingMemberRoles as Mock;
const mockRedisSet = redisSet as Mock;

describe("updateUserPermissionsHandler", () => {
    const currentUserId = "auth0|current-user" as Auth0UserID;
    const targetUserId = "auth0|target-user" as Auth0UserID;
    const orgName = "test-org" as Auth0OrgName;
    const orgId = "org_123";

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetOrgIdFromName.mockResolvedValue(orgId);
        mockGetRoles.mockResolvedValue({ data: [] });
        mockGetUserRoles.mockResolvedValue([]);
        mockAddRoles.mockResolvedValue(undefined);
        mockRemoveRoles.mockResolvedValue(undefined);
        mockAddUserRoleForResource.mockResolvedValue(undefined);
        mockRemoveUserRoleForResource.mockResolvedValue(undefined);
        mockInvalidateCaches.mockResolvedValue(undefined);
        mockRedisSet.mockResolvedValue(undefined);
    });

    describe("self-modification prevention", () => {
        it("returns error when user tries to modify self", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId: targetUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "editor", cliEnabled: false }
            });

            expect(result).toEqual({
                ok: false,
                code: "cannot_modify_self",
                message: "You cannot modify your own permissions."
            });
        });
    });

    describe("validation", () => {
        it("rejects cliEnabled for non-editor org role", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "viewer", cliEnabled: true }
            });

            expect(result).toEqual({
                ok: false,
                code: "invalid_permissions",
                message: "CLI access can only be enabled for the editor role. Admins have implicit CLI access."
            });
        });

        it("rejects empty resourceRoles for fine-grained", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "fine-grained", resourceRoles: {} }
            });

            expect(result).toEqual({
                ok: false,
                code: "invalid_permissions",
                message: "Fine-grained permissions require at least one resource with a role assigned."
            });
        });
    });

    describe("org-level permissions", () => {
        it("updates Auth0 roles correctly (org → org)", async () => {
            mockGetRoles.mockResolvedValue({ data: ["viewer"] });

            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "editor", cliEnabled: false }
            });

            expect(result).toEqual({ ok: true });
            expect(mockRemoveRoles).toHaveBeenCalledWith({
                userId: targetUserId,
                orgId,
                roleNames: ["viewer"]
            });
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId: targetUserId,
                orgId,
                roleNames: ["editor"]
            });
        });

        it("adds CLI role for editor with cliEnabled", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "editor", cliEnabled: true }
            });

            expect(result).toEqual({ ok: true });
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId: targetUserId,
                orgId,
                roleNames: ["editor", "cli"]
            });
        });

        it("removes existing resource roles when switching to org-level", async () => {
            mockGetUserRoles.mockResolvedValue([
                { resource_type: "docs", resource_id: "docs.example.com", role: "editor" },
                { resource_type: "docs", resource_id: "docs.example.com", role: "cli" }
            ]);

            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "admin", cliEnabled: false }
            });

            expect(result).toEqual({ ok: true });
            expect(mockRemoveUserRoleForResource).toHaveBeenCalledTimes(2);
            expect(mockRemoveUserRoleForResource).toHaveBeenCalledWith({
                orgId,
                userId: targetUserId,
                resourceType: "docs",
                resourceId: "docs.example.com",
                role: "editor"
            });
        });

        it("invalidates user session on success", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "viewer", cliEnabled: false }
            });

            expect(result).toEqual({ ok: true });
            expect(mockRedisSet).toHaveBeenCalled();
            expect(mockInvalidateCaches).toHaveBeenCalledWith(orgName);
        });
    });

    describe("fine-grained permissions", () => {
        it("removes org-level roles when switching to fine-grained", async () => {
            mockGetRoles.mockResolvedValue({ data: ["editor", "cli"] });

            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: {
                    type: "fine-grained",
                    resourceRoles: {
                        "docs.example.com": { role: "editor", cliEnabled: false }
                    }
                }
            });

            expect(result).toEqual({ ok: true });
            expect(mockRemoveRoles).toHaveBeenCalledWith({
                userId: targetUserId,
                orgId,
                roleNames: ["editor", "cli"]
            });
        });

        it("adds resource roles correctly", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: {
                    type: "fine-grained",
                    resourceRoles: {
                        "docs.example.com": { role: "editor", cliEnabled: false },
                        "api.example.com": { role: "viewer", cliEnabled: false }
                    }
                }
            });

            expect(result).toEqual({ ok: true });
            expect(mockAddUserRoleForResource).toHaveBeenCalledWith({
                org_id: orgId,
                user_id: targetUserId,
                resource_type: "docs",
                resource_id: "docs.example.com",
                role: "editor"
            });
            expect(mockAddUserRoleForResource).toHaveBeenCalledWith({
                org_id: orgId,
                user_id: targetUserId,
                resource_type: "docs",
                resource_id: "api.example.com",
                role: "viewer"
            });
        });

        it("adds CLI role for editor resources with cliEnabled", async () => {
            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: {
                    type: "fine-grained",
                    resourceRoles: {
                        "docs.example.com": { role: "editor", cliEnabled: true }
                    }
                }
            });

            expect(result).toEqual({ ok: true });
            // Should add both the editor role and the cli role
            expect(mockAddUserRoleForResource).toHaveBeenCalledTimes(2);
            expect(mockAddUserRoleForResource).toHaveBeenCalledWith({
                org_id: orgId,
                user_id: targetUserId,
                resource_type: "docs",
                resource_id: "docs.example.com",
                role: "editor"
            });
            expect(mockAddUserRoleForResource).toHaveBeenCalledWith({
                org_id: orgId,
                user_id: targetUserId,
                resource_type: "docs",
                resource_id: "docs.example.com",
                role: "cli"
            });
        });

        it("clears existing resource roles before adding new ones", async () => {
            mockGetUserRoles.mockResolvedValue([
                { resource_type: "docs", resource_id: "old-docs.example.com", role: "admin" }
            ]);

            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: {
                    type: "fine-grained",
                    resourceRoles: {
                        "new-docs.example.com": { role: "editor", cliEnabled: false }
                    }
                }
            });

            expect(result).toEqual({ ok: true });
            expect(mockRemoveUserRoleForResource).toHaveBeenCalledWith({
                orgId,
                userId: targetUserId,
                resourceType: "docs",
                resourceId: "old-docs.example.com",
                role: "admin"
            });
        });
    });

    describe("error handling", () => {
        it("returns error on Auth0 failure", async () => {
            mockGetOrgIdFromName.mockRejectedValue(new Error("Auth0 error"));

            const result = await updateUserPermissionsHandler({
                currentUserId,
                orgName,
                userId: targetUserId,
                permissions: { type: "org", role: "editor", cliEnabled: false }
            });

            expect(result).toEqual({
                ok: false,
                code: "error",
                message: "Failed to update user permissions. Please try again."
            });
        });
    });
});
