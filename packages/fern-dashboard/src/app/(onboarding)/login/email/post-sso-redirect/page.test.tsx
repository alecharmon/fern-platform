import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/font/local before importing components
vi.mock("next/font/local", () => ({
    default: () => ({
        className: "mock-font",
        style: { fontFamily: "mock-font" }
    })
}));

import PostSsoRedirectPage from "./page";

class RedirectError extends Error {
    constructor(public url: string) {
        super(`Redirected to ${url}`);
    }
}

const mocks = vi.hoisted(() => ({
    mockRedirect: vi.fn((url: string) => {
        throw new RedirectError(url);
    }),
    mockGetCurrentSession: vi.fn(),
    mockGetMyOrganizations: vi.fn(),
    mockGetVenusClient: vi.fn(),
    mockAddUserToOrgById: vi.fn(),
    mockInvalidateCachesAfterAddingOrgMember: vi.fn(),
    mockConsumeLoginAttempt: vi.fn(),
    mockGetEmailLoginConfig: vi.fn(),
    mockAttemptGroupPermSync: vi.fn(),
    mockAttemptOrgLevelRole: vi.fn()
}));

vi.mock("next/navigation", () => ({
    redirect: mocks.mockRedirect
}));

vi.mock("next/headers", () => ({}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: mocks.mockGetCurrentSession
}));

vi.mock("@/app/api/get-my-organizations/handler", () => ({
    __esModule: true,
    default: mocks.mockGetMyOrganizations
}));

vi.mock("@/app/services/venus/getVenusClient", () => ({
    getVenusClient: mocks.mockGetVenusClient
}));

vi.mock("@/app/services/auth0/management", () => ({
    addUserToOrgById: mocks.mockAddUserToOrgById,
    invalidateCachesAfterAddingOrgMember: mocks.mockInvalidateCachesAfterAddingOrgMember
}));

vi.mock("@/app/services/auth0/loginAttempts", () => ({
    consumeLoginAttempt: mocks.mockConsumeLoginAttempt
}));

vi.mock("@fern-docs/edge-config", () => ({
    getEmailLoginConfig: mocks.mockGetEmailLoginConfig
}));

vi.mock("@/app/services/auth0/types", () => ({
    Auth0OrgID: (id: string) => id,
    Auth0UserID: (id: string) => id,
    Auth0OrgName: (name: string) => name
}));

vi.mock("./permission-sync", () => ({
    attemptGroupPermSync: mocks.mockAttemptGroupPermSync,
    attemptOrgLevelRole: mocks.mockAttemptOrgLevelRole
}));

vi.mock("./SilentReauthLoader", () => ({
    __esModule: true,
    default: ({ orgId, destination }: { orgId: string; destination: string }) => (
        <div data-testid="silent-reauth-loader" data-org-id={orgId} data-destination={destination} />
    )
}));

describe("post-sso-redirect page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.mockRedirect.mockImplementation((url: string) => {
            throw new RedirectError(url);
        });
        mocks.mockAttemptGroupPermSync.mockResolvedValue(undefined);
        mocks.mockAttemptOrgLevelRole.mockResolvedValue(undefined);
        mocks.mockInvalidateCachesAfterAddingOrgMember.mockResolvedValue(undefined);
        mocks.mockGetEmailLoginConfig.mockResolvedValue({
            supportedPlatforms: [],
            connectionToOrg: {
                oktahey: {
                    org_id: "org_123",
                    org_name: "acme",
                    use_group_mappings: false
                }
            },
            byEmailDomain: {}
        });
        mocks.mockConsumeLoginAttempt.mockResolvedValue({
            email: "user@example.com",
            connection: "oktahey",
            orgId: "org_123",
            orgName: "acme",
            redirectPath: "/welcome",
            createdAt: "2026-03-11T00:00:00.000Z"
        });
    });

    it("consumes the login attempt, provisions membership, and renders silent reauth", async () => {
        const addUser = vi.fn();
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });
        mocks.mockGetMyOrganizations.mockResolvedValue([]);
        mocks.mockGetVenusClient.mockReturnValue({
            organization: { addUser }
        });

        const result = await PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        expect(result).toBeDefined();
        expect(mocks.mockConsumeLoginAttempt).toHaveBeenCalledWith("attempt-123");
        expect(addUser).toHaveBeenCalledWith({ orgId: "org_123", userId: "auth0|user" });
        expect(mocks.mockAddUserToOrgById).toHaveBeenCalledWith("auth0|user", "org_123");
        expect(mocks.mockInvalidateCachesAfterAddingOrgMember).toHaveBeenCalledWith("auth0|user", "acme");
        expect(mocks.mockAttemptOrgLevelRole).toHaveBeenCalledWith({
            userId: "auth0|user",
            orgId: "org_123",
            defaultRole: undefined
        });
    });

    it("uses the stored redirect path as an org-relative destination", async () => {
        mocks.mockConsumeLoginAttempt.mockResolvedValue({
            email: "user@example.com",
            connection: "oktahey",
            orgId: "org_123",
            orgName: "acme",
            redirectPath: "/",
            createdAt: "2026-03-11T00:00:00.000Z"
        });
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });
        mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);

        const result = await PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        expect(result).toBeDefined();
        expect((result as any).props.destination).toBe(
            "/auth/login?redirect_on_login=%2Facme%2Fdocs&organization=org_123&scope=openid+profile+email+offline_access"
        );
    });

    it("resolves role sync settings by stored org identity rather than connection", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });
        mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);
        mocks.mockGetVenusClient.mockReturnValue({
            organization: { addUser: vi.fn() }
        });
        mocks.mockGetEmailLoginConfig.mockResolvedValue({
            supportedPlatforms: [],
            connectionToOrg: {
                differentConnection: {
                    org_id: "org_123",
                    org_name: "acme",
                    use_group_mappings: true
                }
            },
            byEmailDomain: {}
        });

        const result = await PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        expect(result).toBeDefined();
        expect(mocks.mockAttemptGroupPermSync).toHaveBeenCalledWith({
            userId: "auth0|user",
            orgId: "org_123",
            connection: "oktahey"
        });
        expect(mocks.mockAttemptOrgLevelRole).not.toHaveBeenCalled();
    });

    it("redirects home when login_attempt is missing", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });

        const pagePromise = PostSsoRedirectPage({
            searchParams: Promise.resolve({})
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/" });
        expect(mocks.mockConsumeLoginAttempt).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith("Missing login attempt query param after SSO", {
            searchParams: {}
        });
    });

    it("redirects home when login attempt is missing from redis", async () => {
        mocks.mockConsumeLoginAttempt.mockResolvedValue(undefined);
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });

        const pagePromise = PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/" });
        expect(mocks.mockGetMyOrganizations).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith("Missing or expired login attempt after SSO", {
            loginAttemptId: "attempt-123"
        });
    });

    it("redirects home when the consumed login attempt is invalid", async () => {
        mocks.mockConsumeLoginAttempt.mockResolvedValue({
            connection: "oktahey",
            orgId: "org_123",
            orgName: "acme",
            createdAt: "2026-03-11T00:00:00.000Z"
        });
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });

        const pagePromise = PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/" });
        expect(mocks.mockGetMyOrganizations).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith("Invalid login attempt after SSO", {
            loginAttemptId: "attempt-123",
            loginAttempt: {
                connection: "oktahey",
                orgId: "org_123",
                orgName: "acme",
                createdAt: "2026-03-11T00:00:00.000Z"
            }
        });
    });

    it("redirects to login when the session is missing", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(null);

        const pagePromise = PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/login" });
        expect(mocks.mockConsumeLoginAttempt).not.toHaveBeenCalled();
    });

    it("fails closed when provisioning throws", async () => {
        const addUser = vi.fn().mockRejectedValue(new Error("venus failed"));
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });
        mocks.mockGetMyOrganizations.mockResolvedValue([]);
        mocks.mockGetVenusClient.mockReturnValue({
            organization: { addUser }
        });

        const pagePromise = PostSsoRedirectPage({
            searchParams: Promise.resolve({
                login_attempt: "attempt-123"
            })
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/" });
        expect(mocks.mockAttemptGroupPermSync).not.toHaveBeenCalled();
        expect(mocks.mockAttemptOrgLevelRole).not.toHaveBeenCalled();
    });
});
