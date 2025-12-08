import { beforeEach, describe, expect, it, vi } from "vitest";

import PostSsoRedirectPage from "./page";

class RedirectError extends Error {
    constructor(public url: string) {
        super(`Redirected to ${url}`);
    }
}

const mocks = vi.hoisted(() => {
    return {
        mockRedirect: vi.fn((url: string) => {
            throw new RedirectError(url);
        }),
        mockGetCurrentSession: vi.fn(),
        mockGetMyOrganizations: vi.fn(),
        mockGetVenusClient: vi.fn(),
        mockAddUserToOrgById: vi.fn(),
        mockGetEmailLoginConfig: vi.fn()
    };
});

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
    addUserToOrgById: mocks.mockAddUserToOrgById
}));

vi.mock("@fern-docs/edge-config", () => ({
    getEmailLoginConfig: mocks.mockGetEmailLoginConfig
}));

vi.mock("@/app/services/auth0/types", () => ({
    Auth0OrgID: (id: string) => id,
    Auth0UserID: (id: string) => id
}));

describe("post-sso-redirect page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockRedirect.mockImplementation((url: string) => {
            throw new RedirectError(url);
        });
        mocks.mockGetEmailLoginConfig.mockResolvedValue({
            supportedPlatforms: [],
            connectionToOrg: {
                oktahey: {
                    org_id: "org_123",
                    org_name: "acme"
                }
            },
            byEmailDomain: {}
        });
    });

    it("adds user to org when missing and redirects to provided path", async () => {
        const addUser = vi.fn();
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });
        mocks.mockGetMyOrganizations.mockResolvedValue([]);
        mocks.mockGetVenusClient.mockReturnValue({
            organization: { addUser }
        });

        const pagePromise = PostSsoRedirectPage({
            searchParams: {
                connection: "oktahey",
                redirect: "/docs",
                default_redirect: "/acme"
            }
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/docs" });
        expect(addUser).toHaveBeenCalledWith({ orgId: "org_123", userId: "auth0|user" });
        expect(mocks.mockAddUserToOrgById).toHaveBeenCalledWith("auth0|user", "org_123");
    });

    it("skips adding user when already in org and redirects", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });
        mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);
        mocks.mockGetVenusClient.mockReturnValue({ organization: { addUser: vi.fn() } });

        const pagePromise = PostSsoRedirectPage({
            searchParams: {
                connection: "oktahey",
                redirect: "/welcome",
                default_redirect: "/acme"
            }
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/welcome" });
        expect(mocks.mockAddUserToOrgById).not.toHaveBeenCalled();
    });

    it("redirects to login when session is missing", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(null);

        const pagePromise = PostSsoRedirectPage({
            searchParams: {
                connection: "oktahey",
                redirect: "/docs",
                default_redirect: "/acme"
            }
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/login" });
    });

    it("redirects home on invalid params", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue({
            accessToken: "token",
            user: { sub: "auth0|user" }
        });

        const pagePromise = PostSsoRedirectPage({
            searchParams: {
                org_name: "acme"
            }
        });

        await expect(pagePromise).rejects.toMatchObject({ url: "/" });
        expect(mocks.mockGetMyOrganizations).not.toHaveBeenCalled();
    });
});
