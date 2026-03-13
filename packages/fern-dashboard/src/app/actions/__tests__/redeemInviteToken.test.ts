import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

// Mock next/cache to avoid "static generation store missing" errors in tests
vi.mock("next/cache", () => ({
    revalidateTag: vi.fn()
}));

// Mock all external dependencies
vi.mock("@fern-api/user-permissions", () => ({
    addRoles: vi.fn()
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSessionOrThrow: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    getInviteToken: vi.fn(),
    invalidateCachesAfterRedeemingInviteToken: vi.fn(),
    doesUserBelongToOrg: vi.fn(),
    addUserToOrg: vi.fn(),
    getOrgIdFromName: vi.fn()
}));

// Import mocked modules
import { addRoles } from "@fern-api/user-permissions";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";

import { redeemInviteToken } from "../redeemInviteToken";

const mockAddRoles = addRoles as Mock;
const mockGetCurrentSession = getCurrentSessionOrThrow as Mock;
const mockGetInviteToken = auth0Management.getInviteToken as Mock;
const mockInvalidateCaches = auth0Management.invalidateCachesAfterRedeemingInviteToken as Mock;
const mockDoesUserBelongToOrg = auth0Management.doesUserBelongToOrg as Mock;
const mockAddUserToOrg = auth0Management.addUserToOrg as Mock;
const mockGetOrgIdFromName = auth0Management.getOrgIdFromName as Mock;

describe("redeemInviteToken", () => {
    const userId = "auth0|test-user" as Auth0UserID;
    const orgName = "test-org" as Auth0OrgName;
    const orgId = "org_123";
    const token = "test-token-123";

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentSession.mockResolvedValue({
            user: { sub: userId },
            permissions: []
        });
        mockGetOrgIdFromName.mockResolvedValue(orgId);
        mockDoesUserBelongToOrg.mockResolvedValue(false);
        mockAddUserToOrg.mockResolvedValue(undefined);
        mockAddRoles.mockResolvedValue(undefined);
        mockInvalidateCaches.mockResolvedValue(undefined);
    });

    describe("authentication", () => {
        it("returns NOT_LOGGED_IN error when session is not available", async () => {
            mockGetCurrentSession.mockRejectedValue(new Error("Not logged in"));

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: false,
                error: { type: "NOT_LOGGED_IN" }
            });
        });
    });

    describe("token validation", () => {
        it("returns INVITE_TOKEN_NOT_FOUND when token does not exist", async () => {
            mockGetInviteToken.mockResolvedValue(null);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: false,
                error: { type: "INVITE_TOKEN_NOT_FOUND" }
            });
        });

        it("returns EXPIRED_INVITE_TOKEN when token has expired", async () => {
            const expiredToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            };
            mockGetInviteToken.mockResolvedValue(expiredToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: false,
                error: { type: "EXPIRED_INVITE_TOKEN" }
            });
            expect(mockInvalidateCaches).toHaveBeenCalledWith(token);
        });
    });

    describe("existing member handling", () => {
        it("succeeds without adding user if already a member", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: ["editor" as const]
            };
            mockGetInviteToken.mockResolvedValue(validToken);
            mockDoesUserBelongToOrg.mockResolvedValue(true);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddUserToOrg).not.toHaveBeenCalled();
            expect(mockAddRoles).not.toHaveBeenCalled();
            expect(mockInvalidateCaches).toHaveBeenCalledWith(token);
        });
    });

    describe("new member - role assignment", () => {
        it("adds user to org without roles when token has no roles", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                // no roles specified
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddUserToOrg).toHaveBeenCalledWith(userId, orgName);
            expect(mockAddRoles).not.toHaveBeenCalled();
            expect(mockInvalidateCaches).toHaveBeenCalledWith(token);
        });

        it("adds user to org with viewer role", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: ["viewer" as const]
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddUserToOrg).toHaveBeenCalledWith(userId, orgName);
            expect(mockGetOrgIdFromName).toHaveBeenCalledWith(orgName);
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId,
                orgId,
                roleNames: ["viewer"]
            });
        });

        it("adds user to org with editor role", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: ["editor" as const]
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId,
                orgId,
                roleNames: ["editor"]
            });
        });

        it("adds user to org with admin role", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: ["admin" as const]
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId,
                orgId,
                roleNames: ["admin"]
            });
        });

        it("adds user to org with editor role and CLI access", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: ["editor" as const, "cli" as const]
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId,
                orgId,
                roleNames: ["editor", "cli"]
            });
        });

        it("does not assign roles when roles array is empty", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: [] as ("admin" | "editor" | "viewer" | "cli")[]
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            const result = await redeemInviteToken({ token });

            expect(result).toEqual({
                success: true,
                orgName,
                userId
            });
            expect(mockAddUserToOrg).toHaveBeenCalledWith(userId, orgName);
            expect(mockAddRoles).not.toHaveBeenCalled();
        });
    });

    describe("token cleanup", () => {
        it("invalidates token cache after successful redemption", async () => {
            const validToken = {
                orgName,
                inviterId: "inviter-123",
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                roles: ["viewer" as const]
            };
            mockGetInviteToken.mockResolvedValue(validToken);

            await redeemInviteToken({ token });

            expect(mockInvalidateCaches).toHaveBeenCalledWith(token);
        });
    });
});
