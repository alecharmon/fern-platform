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

const mocks = vi.hoisted(() => {
    return {
        mockRedirect: vi.fn((url: string) => {
            throw new RedirectError(url);
        }),
        mockGetCurrentSession: vi.fn(),
        mockGetMyOrganizations: vi.fn(),
        mockGetVenusClient: vi.fn(),
        mockAddUserToOrgById: vi.fn(),
        mockGetEmailLoginConfig: vi.fn(),
        mockGetAuth0Client: vi.fn(),
        mockGetRoles: vi.fn(),
        mockAddRoles: vi.fn(),
        mockOrgRedirect: vi.fn()
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

vi.mock("@/app/services/auth0/auth0", () => ({
    getAuth0Client: mocks.mockGetAuth0Client
}));
vi.mock("@fern-api/user-permissions", () => ({
    getRoles: mocks.mockGetRoles,
    addRoles: mocks.mockAddRoles
}));

vi.mock("@/app/services/auth0/types", () => ({
    Auth0OrgID: (id: string) => id,
    Auth0UserID: (id: string) => id,
    Auth0OrgName: (name: string) => name
}));

vi.mock("@/utils/orgRedirect", () => ({
    __esModule: true,
    default: mocks.mockOrgRedirect
}));

describe("post-sso-redirect page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockRedirect.mockImplementation((url: string) => {
            throw new RedirectError(url);
        });
        mocks.mockGetAuth0Client.mockResolvedValue({
            getSession: vi.fn().mockResolvedValue(null),
            getAccessToken: vi.fn().mockResolvedValue("new_token"),
            updateSession: vi.fn()
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
        mocks.mockGetRoles.mockResolvedValue({ ok: true, data: ["viewer"] });
        mocks.mockAddRoles.mockResolvedValue({ ok: true });
        mocks.mockOrgRedirect.mockImplementation((org: { id: string; name: string }) => `/auth/login?org=${org.name}`);
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

    describe("default_role behavior", () => {
        it("assigns 'editor' role when default_role is not set", async () => {
            mocks.mockGetCurrentSession.mockResolvedValue({
                accessToken: "token",
                user: { sub: "auth0|user" }
            });
            mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);
            mocks.mockGetVenusClient.mockReturnValue({ organization: { addUser: vi.fn() } });
            mocks.mockGetRoles.mockResolvedValue({ ok: true, data: [] });
            mocks.mockGetEmailLoginConfig.mockResolvedValue({
                supportedPlatforms: [],
                connectionToOrg: {
                    oktahey: {
                        org_id: "org_123",
                        org_name: "acme"
                        // no default_role set
                    }
                },
                byEmailDomain: {}
            });

            const pagePromise = PostSsoRedirectPage({
                searchParams: {
                    connection: "oktahey",
                    redirect: "/docs",
                    default_redirect: "/acme"
                }
            });

            // When roles are empty and added, redirects via orgRedirect
            await expect(pagePromise).rejects.toMatchObject({ url: "/auth/login?org=acme" });
            expect(mocks.mockAddRoles).toHaveBeenCalledWith({
                userId: "auth0|user",
                orgId: "org_123",
                roleNames: ["editor"]
            });
        });

        it("assigns configured default_role when set to 'viewer'", async () => {
            mocks.mockGetCurrentSession.mockResolvedValue({
                accessToken: "token",
                user: { sub: "auth0|user" }
            });
            mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);
            mocks.mockGetVenusClient.mockReturnValue({ organization: { addUser: vi.fn() } });
            mocks.mockGetRoles.mockResolvedValue({ ok: true, data: [] });
            mocks.mockGetEmailLoginConfig.mockResolvedValue({
                supportedPlatforms: [],
                connectionToOrg: {
                    oktahey: {
                        org_id: "org_123",
                        org_name: "acme",
                        default_role: "viewer"
                    }
                },
                byEmailDomain: {}
            });

            const pagePromise = PostSsoRedirectPage({
                searchParams: {
                    connection: "oktahey",
                    redirect: "/docs",
                    default_redirect: "/acme"
                }
            });

            // When roles are empty and added, redirects via orgRedirect
            await expect(pagePromise).rejects.toMatchObject({ url: "/auth/login?org=acme" });
            expect(mocks.mockAddRoles).toHaveBeenCalledWith({
                userId: "auth0|user",
                orgId: "org_123",
                roleNames: ["viewer"]
            });
        });

        it("assigns configured default_role when set to 'admin'", async () => {
            mocks.mockGetCurrentSession.mockResolvedValue({
                accessToken: "token",
                user: { sub: "auth0|user" }
            });
            mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);
            mocks.mockGetVenusClient.mockReturnValue({ organization: { addUser: vi.fn() } });
            mocks.mockGetRoles.mockResolvedValue({ ok: true, data: [] });
            mocks.mockGetEmailLoginConfig.mockResolvedValue({
                supportedPlatforms: [],
                connectionToOrg: {
                    oktahey: {
                        org_id: "org_123",
                        org_name: "acme",
                        default_role: "admin"
                    }
                },
                byEmailDomain: {}
            });

            const pagePromise = PostSsoRedirectPage({
                searchParams: {
                    connection: "oktahey",
                    redirect: "/docs",
                    default_redirect: "/acme"
                }
            });

            // When roles are empty and added, redirects via orgRedirect
            await expect(pagePromise).rejects.toMatchObject({ url: "/auth/login?org=acme" });
            expect(mocks.mockAddRoles).toHaveBeenCalledWith({
                userId: "auth0|user",
                orgId: "org_123",
                roleNames: ["admin"]
            });
        });

        it("does not assign roles when user already has roles", async () => {
            mocks.mockGetCurrentSession.mockResolvedValue({
                accessToken: "token",
                user: { sub: "auth0|user" }
            });
            mocks.mockGetMyOrganizations.mockResolvedValue([{ id: "org_123" }]);
            mocks.mockGetVenusClient.mockReturnValue({ organization: { addUser: vi.fn() } });
            mocks.mockGetRoles.mockResolvedValue({ ok: true, data: ["viewer"] });
            mocks.mockGetEmailLoginConfig.mockResolvedValue({
                supportedPlatforms: [],
                connectionToOrg: {
                    oktahey: {
                        org_id: "org_123",
                        org_name: "acme",
                        default_role: "admin"
                    }
                },
                byEmailDomain: {}
            });

            const pagePromise = PostSsoRedirectPage({
                searchParams: {
                    connection: "oktahey",
                    redirect: "/docs",
                    default_redirect: "/acme"
                }
            });

            // When user already has roles, redirects to destination without adding roles
            await expect(pagePromise).rejects.toMatchObject({ url: "/docs" });
            expect(mocks.mockAddRoles).not.toHaveBeenCalled();
        });
    });
});
