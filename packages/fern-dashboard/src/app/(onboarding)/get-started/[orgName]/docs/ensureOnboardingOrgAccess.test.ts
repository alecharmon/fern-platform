import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string };
        error.digest = `NEXT_REDIRECT;${url}`;
        throw error;
    })
}));

// Mock all external dependencies
vi.mock("@fern-api/user-permissions", () => ({
    addRoles: vi.fn()
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    addUserToOrgById: vi.fn(),
    getOrgIdFromName: vi.fn()
}));

vi.mock("@/app/services/dal/organization", () => ({
    assertUserHasOrganizationAccess: vi.fn(),
    getOrganizationForPostmanTeam: vi.fn()
}));

vi.mock("@/app/services/entitlements/checker", () => ({
    getEntitlementsChecker: vi.fn()
}));

vi.mock("@/app/services/postman/openapi-repository", () => ({
    isUserInTeam: vi.fn()
}));

vi.mock("@/app/services/venus/getVenusClient", () => ({
    getVenusClient: vi.fn()
}));

vi.mock("@/components/posthog/feature-flags/server-side", () => ({
    isFeatureFlagEnabledForUser: vi.fn(),
    isEntitlementsEnabled: vi.fn()
}));

vi.mock("./serializeSearchParams", () => ({
    serializeSearchParams: vi.fn((params?: Record<string, string | string[] | undefined>) => {
        const urlParams = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    if (Array.isArray(value)) {
                        value.forEach((v) => urlParams.append(key, v));
                    } else {
                        urlParams.append(key, value as string);
                    }
                }
            });
        }
        return urlParams;
    })
}));

import { addRoles } from "@fern-api/user-permissions";
// Import mocked modules
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { addUserToOrgById, getOrgIdFromName } from "@/app/services/auth0/management";
import { assertUserHasOrganizationAccess, getOrganizationForPostmanTeam } from "@/app/services/dal/organization";
import { getEntitlementsChecker } from "@/app/services/entitlements/checker";
import { isUserInTeam } from "@/app/services/postman/openapi-repository";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import { isEntitlementsEnabled, isFeatureFlagEnabledForUser } from "@/components/posthog/feature-flags/server-side";

import { ensureOnboardingOrgAccess } from "./ensureOnboardingOrgAccess";

const mockRedirect = redirect as unknown as Mock;
const mockAddRoles = addRoles as Mock;
const mockGetCurrentSession = getCurrentSession as Mock;
const mockAddUserToOrgById = addUserToOrgById as Mock;
const mockGetOrgIdFromName = getOrgIdFromName as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;
const mockGetOrganizationForPostmanTeam = getOrganizationForPostmanTeam as Mock;
const mockGetEntitlementsChecker = getEntitlementsChecker as Mock;
const mockIsUserInTeam = isUserInTeam as Mock;
const mockGetVenusClient = getVenusClient as Mock;
const mockIsFeatureFlagEnabledForUser = isFeatureFlagEnabledForUser as Mock;
const mockIsEntitlementsEnabled = isEntitlementsEnabled as Mock;

describe("ensureOnboardingOrgAccess", () => {
    const userId = "auth0|test-user" as Auth0UserID;
    const orgName = "test-org" as Auth0OrgName;
    const orgId = "org_123";
    const auth0OrgId = "org_auth0_123";
    const postmanTeamId = "postman-team-456";
    const requestedPath = `/get-started/${orgName}/docs`;
    const accessToken = "mock-access-token";

    const mockSession = {
        user: { sub: userId },
        accessToken
    };

    const mockVenusClient = {
        organization: {
            addUser: vi.fn()
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentSession.mockResolvedValue(mockSession);
        mockIsFeatureFlagEnabledForUser.mockResolvedValue(false);
        mockIsEntitlementsEnabled.mockResolvedValue(false);
        mockGetVenusClient.mockReturnValue(mockVenusClient);
        mockVenusClient.organization.addUser.mockResolvedValue(undefined);
        mockAddUserToOrgById.mockResolvedValue(undefined);
        mockAddRoles.mockResolvedValue(undefined);
    });

    describe("authentication", () => {
        it("redirects to login when session is null", async () => {
            mockGetCurrentSession.mockResolvedValue(null);

            await expect(ensureOnboardingOrgAccess(orgName, requestedPath)).rejects.toThrow("NEXT_REDIRECT: /login");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
        });

        it("redirects to postman auth when session is null and postman-team-id is present", async () => {
            mockGetCurrentSession.mockResolvedValue(null);

            await expect(
                ensureOnboardingOrgAccess(orgName, requestedPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/auth/login?connection=postman");
            expect(redirectUrl).toContain("redirect_on_login");
        });
    });

    describe("user has access to org", () => {
        it("returns session when user already has access", async () => {
            mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);

            const result = await ensureOnboardingOrgAccess(orgName, requestedPath);

            expect(result).toEqual(mockSession);
            expect(mockAssertUserHasOrganizationAccess).toHaveBeenCalledWith(accessToken, orgName);
        });
    });

    describe("postman team integration - org exists", () => {
        beforeEach(() => {
            // User doesn't have access initially
            mockAssertUserHasOrganizationAccess.mockRejectedValue(new Error("No access"));
        });

        it("adds user to org when postman team has org and user is in team", async () => {
            mockGetOrganizationForPostmanTeam.mockResolvedValue({
                success: true,
                orgId,
                auth0OrgId
            });
            mockIsUserInTeam.mockResolvedValue(true);

            await expect(
                ensureOnboardingOrgAccess(orgName, requestedPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT");

            // Verify user was added to org
            expect(mockGetVenusClient).toHaveBeenCalledWith({ token: accessToken });
            expect(mockVenusClient.organization.addUser).toHaveBeenCalledWith({
                orgId,
                userId
            });
            expect(mockAddUserToOrgById).toHaveBeenCalledWith(userId, auth0OrgId);

            // Verify admin role was assigned
            expect(mockAddRoles).toHaveBeenCalledWith({
                userId,
                orgId: auth0OrgId,
                roleNames: ["admin"]
            });

            // Verify redirect to org path
            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain(`/get-started/${orgId}/docs`);
        });

        it("redirects to not-found when postman team has org but user is not in team", async () => {
            mockGetOrganizationForPostmanTeam.mockResolvedValue({
                success: true,
                orgId,
                auth0OrgId
            });
            mockIsUserInTeam.mockResolvedValue(false);

            await expect(
                ensureOnboardingOrgAccess(orgName, requestedPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT: /get-started/not-found?postman-team-id=postman-team-456");

            // Verify user was NOT added to org
            expect(mockVenusClient.organization.addUser).not.toHaveBeenCalled();
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
            expect(mockAddRoles).not.toHaveBeenCalled();

            expect(mockRedirect).toHaveBeenCalledWith(
                `/get-started/not-found?postman-team-id=${encodeURIComponent(postmanTeamId)}`
            );
        });

        it("preserves search params when redirecting after adding user to org", async () => {
            mockGetOrganizationForPostmanTeam.mockResolvedValue({
                success: true,
                orgId,
                auth0OrgId
            });
            mockIsUserInTeam.mockResolvedValue(true);

            const searchParams = {
                "postman-team-id": postmanTeamId,
                "another-param": "value"
            };

            await expect(ensureOnboardingOrgAccess(orgName, requestedPath, searchParams)).rejects.toThrow(
                "NEXT_REDIRECT"
            );

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain(`/get-started/${orgId}/docs`);
            expect(redirectUrl).toContain("postman-team-id=postman-team-456");
            expect(redirectUrl).toContain("another-param=value");
        });

        it("handles error when checking if user is in postman team", async () => {
            mockGetOrganizationForPostmanTeam.mockResolvedValue({
                success: true,
                orgId,
                auth0OrgId
            });
            mockIsUserInTeam.mockRejectedValue(new Error("API error"));

            await expect(
                ensureOnboardingOrgAccess(orgName, requestedPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT: /get-started/not-found");

            // Should default to false when error occurs
            expect(mockVenusClient.organization.addUser).not.toHaveBeenCalled();
        });

        it("continues to assign admin role even if role assignment fails", async () => {
            mockGetOrganizationForPostmanTeam.mockResolvedValue({
                success: true,
                orgId,
                auth0OrgId
            });
            mockIsUserInTeam.mockResolvedValue(true);
            mockAddRoles.mockRejectedValue(new Error("Role assignment failed"));

            // Should not throw - error is logged but flow continues
            await expect(
                ensureOnboardingOrgAccess(orgName, requestedPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT");

            // Verify redirect still happens
            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain(`/get-started/${orgId}/docs`);
        });
    });

    describe("postman team integration - no org exists", () => {
        beforeEach(() => {
            mockAssertUserHasOrganizationAccess.mockRejectedValue(new Error("No access"));
        });

        it("redirects to create-org when postman team does not have org", async () => {
            mockGetOrganizationForPostmanTeam.mockResolvedValue({
                success: false
            });

            await expect(
                ensureOnboardingOrgAccess(orgName, requestedPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/get-started/create-org");
            expect(redirectUrl).toContain(`prefillOrgName=${postmanTeamId}`);
            expect(redirectUrl).toContain("next=%2Fget-started%2F%3AorgId%2Fdocs");
        });
    });

    describe("no postman team integration", () => {
        beforeEach(() => {
            mockAssertUserHasOrganizationAccess.mockRejectedValue(new Error("No access"));
        });

        it("redirects to create-org when no postman-team-id is provided", async () => {
            await expect(ensureOnboardingOrgAccess(orgName, requestedPath)).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/get-started/create-org");
            expect(redirectUrl).toContain("prefillOrgName=test-org");
        });

        it("preserves search params when redirecting to create-org", async () => {
            const searchParams = {
                "custom-param": "value",
                "another-param": "test"
            };

            await expect(ensureOnboardingOrgAccess(orgName, requestedPath, searchParams)).rejects.toThrow(
                "NEXT_REDIRECT"
            );

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/get-started/create-org");
            expect(redirectUrl).toContain("custom-param=value");
            expect(redirectUrl).toContain("another-param=test");
        });
    });

    describe("entitlements check", () => {
        beforeEach(() => {
            mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
        });

        it("redirects to billing when docs_sites entitlement check fails and feature flag is enabled", async () => {
            mockIsEntitlementsEnabled.mockResolvedValue(true);
            mockGetOrgIdFromName.mockResolvedValue(auth0OrgId);
            const mockChecker = {
                check: vi.fn().mockResolvedValue({ entitled: false })
            };
            mockGetEntitlementsChecker.mockReturnValue(mockChecker);

            await expect(ensureOnboardingOrgAccess(orgName, requestedPath)).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirect).toHaveBeenCalledWith(`/${orgName}/billing?reason=docs_site_limit`);
        });

        it("allows through when docs_sites entitlement check passes", async () => {
            mockIsEntitlementsEnabled.mockResolvedValue(true);
            mockGetOrgIdFromName.mockResolvedValue(auth0OrgId);
            const mockChecker = {
                check: vi.fn().mockResolvedValue({ entitled: true })
            };
            mockGetEntitlementsChecker.mockReturnValue(mockChecker);

            const result = await ensureOnboardingOrgAccess(orgName, requestedPath);

            expect(result).toEqual(mockSession);
        });

        it("allows through when entitlements feature flag is disabled", async () => {
            mockIsEntitlementsEnabled.mockResolvedValue(false);

            const result = await ensureOnboardingOrgAccess(orgName, requestedPath);

            expect(result).toEqual(mockSession);
            expect(mockGetEntitlementsChecker).not.toHaveBeenCalled();
        });

        it("allows through when entitlement check throws error", async () => {
            mockIsEntitlementsEnabled.mockResolvedValue(true);
            mockGetOrgIdFromName.mockRejectedValue(new Error("Org not found"));

            // Should not throw - error is logged and user is allowed through
            const result = await ensureOnboardingOrgAccess(orgName, requestedPath);

            expect(result).toEqual(mockSession);
        });
    });

    describe("edge cases", () => {
        it("does not trigger postman flow when on create-org path", async () => {
            mockAssertUserHasOrganizationAccess.mockRejectedValue(new Error("No access"));
            const createOrgPath = `/get-started/${orgName}/create-org`;

            await expect(
                ensureOnboardingOrgAccess(orgName, createOrgPath, { "postman-team-id": postmanTeamId })
            ).rejects.toThrow("NEXT_REDIRECT");

            // Should go directly to create-org redirect, not check postman team
            expect(mockGetOrganizationForPostmanTeam).not.toHaveBeenCalled();
            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/get-started/create-org");
        });
    });
});
