import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

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

// Mock Next.js cache
vi.mock("next/cache", () => ({
    revalidateTag: vi.fn()
}));

vi.mock("@/app/services/dal/getOrgNameFromDocsUrl", () => ({
    getOrgNameFromDocsUrl: vi.fn()
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: vi.fn()
}));

vi.mock("@/app/services/auth0/management", () => ({
    addUserToOrgById: vi.fn(),
    assignRoleToOrgMember: vi.fn(),
    doesUserBelongToOrg: vi.fn(),
    getOrgIdFromName: vi.fn(),
    invalidateCachesAfterAddingOrgMember: vi.fn()
}));

vi.mock("@/app/services/postman/repository", () => ({
    getAppInstallationByTeamId: vi.fn()
}));

vi.mock("@/utils/constructDocsUrlParam", () => ({
    constructDocsUrlParam: vi.fn((url: string) => encodeURIComponent(url))
}));

vi.mock("@/utils/orgRedirect", () => ({
    default: vi.fn(
        (org: { id: string; name: string }, pathname: string) =>
            `/auth/login?redirect_on_login=${encodeURIComponent(`/${org.name}${pathname}`)}&organization=${org.id}`
    )
}));

vi.mock("@/components/posthog/getServerSidePosthog", () => ({
    getServerSidePosthog: vi.fn(() => ({ capture: vi.fn() }))
}));

vi.mock("@/components/posthog/events", () => ({
    PosthogEventName: { POSTMAN_VIEW_DOCS_ENTERED: "dashboard-postman-view-docs-entered" }
}));

// Import mocked modules
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import {
    addUserToOrgById,
    assignRoleToOrgMember,
    doesUserBelongToOrg,
    getOrgIdFromName,
    invalidateCachesAfterAddingOrgMember
} from "@/app/services/auth0/management";
import { getOrgNameFromDocsUrl } from "@/app/services/dal/getOrgNameFromDocsUrl";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";

import orgRedirect from "@/utils/orgRedirect";
import ViewDocsPage from "../page";

const mockRedirect = redirect as unknown as Mock;
const mockOrgRedirect = orgRedirect as unknown as Mock;
const mockGetOrgNameFromDocsUrl = getOrgNameFromDocsUrl as Mock;
const mockGetCurrentSession = getCurrentSession as Mock;
const mockAddUserToOrgById = addUserToOrgById as Mock;
const mockDoesUserBelongToOrg = doesUserBelongToOrg as Mock;
const mockGetOrgIdFromName = getOrgIdFromName as Mock;
const mockGetAppInstallationByTeamId = getAppInstallationByTeamId as Mock;
const mockInvalidateCachesAfterAddingOrgMember = invalidateCachesAfterAddingOrgMember as Mock;
const mockAssignRoleToOrgMember = assignRoleToOrgMember as Mock;

const SHARED_SECRET = "test-shared-secret";
const POSTMAN_TEAM_ID = "team-123";
const DOCS_URL = "my-docs.docs.buildwithfern.com";
const ORG_NAME = "test-org";
const AUTH0_ORG_ID = "org_auth0_abc";
const USER_ID = "auth0|user-456";

function createValidToken(): string {
    return jwt.sign({ postmanTeamId: POSTMAN_TEAM_ID, intent: "edit" }, SHARED_SECRET, { algorithm: "HS256" });
}

function createPageParams(overrides?: {
    docsUrl?: string;
    token?: string;
    extraSearchParams?: Record<string, string | string[] | undefined>;
}) {
    const docsUrl = overrides?.docsUrl ?? encodeURIComponent(DOCS_URL);
    const token = overrides?.token;
    const searchParams: Record<string, string | string[] | undefined> = {
        ...(token != null ? { token } : {}),
        ...overrides?.extraSearchParams
    };
    return {
        params: Promise.resolve({ docsUrl }),
        searchParams: Promise.resolve(
            Object.keys(searchParams).length > 0 ? searchParams : ({} as Record<string, string | string[] | undefined>)
        )
    };
}

describe("ViewDocsPage", () => {
    const mockSession = {
        user: { sub: USER_ID },
        accessToken: "mock-access-token"
    };

    const mockInstallation = {
        team_id: POSTMAN_TEAM_ID,
        shared_secret: SHARED_SECRET,
        app_installation_id: "install-789",
        team_name: null,
        team_domain: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("FERN_TOKEN", "mock-fern-token");

        mockGetCurrentSession.mockResolvedValue(mockSession);
        mockGetOrgNameFromDocsUrl.mockResolvedValue(ORG_NAME);
        mockGetOrgIdFromName.mockResolvedValue(AUTH0_ORG_ID);
        mockDoesUserBelongToOrg.mockResolvedValue(false);
        mockAddUserToOrgById.mockResolvedValue(undefined);
        mockAssignRoleToOrgMember.mockResolvedValue(undefined);
        mockInvalidateCachesAfterAddingOrgMember.mockResolvedValue(undefined);
        mockGetAppInstallationByTeamId.mockResolvedValue(mockInstallation);
    });

    describe("authentication", () => {
        it("redirects to login when session is null (no token)", async () => {
            mockGetCurrentSession.mockResolvedValue(null);

            await expect(ViewDocsPage(createPageParams())).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/login");
            expect(redirectUrl).toContain(`redirect_on_login`);
            expect(redirectUrl).toContain(`view%2F`);
        });

        it("redirects to login preserving token when session is null", async () => {
            mockGetCurrentSession.mockResolvedValue(null);
            const token = createValidToken();

            await expect(ViewDocsPage(createPageParams({ token }))).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/login");
            expect(redirectUrl).toContain("token");
        });

        it("preserves all query parameters in the login redirect", async () => {
            mockGetCurrentSession.mockResolvedValue(null);
            const token = createValidToken();

            await expect(
                ViewDocsPage(createPageParams({ token, extraSearchParams: { intent: "edit", source: "postman" } }))
            ).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            const decodedRedirect = decodeURIComponent(
                new URL(redirectUrl, "http://localhost").searchParams.get("redirect_on_login") ?? ""
            );
            expect(decodedRedirect).toContain("token=");
            expect(decodedRedirect).toContain("intent=edit");
            expect(decodedRedirect).toContain("source=postman");
        });
    });

    describe("no token / already has access", () => {
        it("redirects to dashboard when user is already an org member", async () => {
            mockDoesUserBelongToOrg.mockResolvedValue(true);

            await expect(ViewDocsPage(createPageParams())).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain(`/${ORG_NAME}/docs/`);
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });

        it("uses FERN_TOKEN to resolve org from docsUrl", async () => {
            mockDoesUserBelongToOrg.mockResolvedValue(true);

            await expect(ViewDocsPage(createPageParams())).rejects.toThrow("NEXT_REDIRECT");

            expect(mockGetOrgNameFromDocsUrl).toHaveBeenCalledWith(DOCS_URL);
        });
    });

    describe("no token / no access", () => {
        it("redirects to login when user is not an org member and has no token", async () => {
            mockDoesUserBelongToOrg.mockResolvedValue(false);

            await expect(ViewDocsPage(createPageParams())).rejects.toThrow("NEXT_REDIRECT: /login");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });

        it("redirects to login when org resolution fails and no token is provided", async () => {
            mockGetOrgNameFromDocsUrl.mockResolvedValue(undefined);

            await expect(ViewDocsPage(createPageParams())).rejects.toThrow("NEXT_REDIRECT: /login");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
        });

        it("redirects to login when FERN_TOKEN is not configured (getOrgNameFromDocsUrl returns undefined)", async () => {
            mockGetOrgNameFromDocsUrl.mockResolvedValue(undefined);

            await expect(ViewDocsPage(createPageParams())).rejects.toThrow("NEXT_REDIRECT: /login");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
        });
    });

    describe("token / auto-add to org flow", () => {
        it("verifies JWT, adds user to org, and redirects through org-scoped auth", async () => {
            const token = createValidToken();

            await expect(ViewDocsPage(createPageParams({ token }))).rejects.toThrow("NEXT_REDIRECT");

            // Verify org was resolved from docsUrl
            expect(mockGetOrgNameFromDocsUrl).toHaveBeenCalledWith(DOCS_URL);

            // Verify installation was looked up by postmanTeamId from JWT
            expect(mockGetAppInstallationByTeamId).toHaveBeenCalledWith(POSTMAN_TEAM_ID);

            // Verify user was added to Auth0 org
            expect(mockGetOrgIdFromName).toHaveBeenCalledWith(ORG_NAME);
            expect(mockAddUserToOrgById).toHaveBeenCalledWith(USER_ID, AUTH0_ORG_ID);

            // Verify editor role was assigned
            expect(mockAssignRoleToOrgMember).toHaveBeenCalledWith(USER_ID, AUTH0_ORG_ID, ["editor"]);

            // Verify cache invalidation was called
            expect(mockInvalidateCachesAfterAddingOrgMember).toHaveBeenCalledWith(USER_ID, ORG_NAME);

            // Verify redirect goes through orgRedirect for org-scoped auth
            expect(mockOrgRedirect).toHaveBeenCalledWith(
                { id: AUTH0_ORG_ID, name: ORG_NAME },
                expect.stringContaining("/docs/")
            );
            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/auth/login");
            expect(redirectUrl).toContain(AUTH0_ORG_ID);
        });

        it("continues to redirect even if user is already a member (addUserToOrgById throws)", async () => {
            const token = createValidToken();
            mockAddUserToOrgById.mockRejectedValue(new Error("User already in org"));

            await expect(ViewDocsPage(createPageParams({ token }))).rejects.toThrow("NEXT_REDIRECT");

            // Should still redirect through org-scoped auth despite the add-user error
            expect(mockOrgRedirect).toHaveBeenCalled();
            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/auth/login");
        });
    });

    describe("token / invalid token", () => {
        it("redirects to login when JWT payload structure is invalid", async () => {
            const invalidToken = jwt.sign({ foo: "bar" }, SHARED_SECRET, { algorithm: "HS256" });

            await expect(ViewDocsPage(createPageParams({ token: invalidToken }))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });

        it("redirects to login when JWT is signed with wrong secret", async () => {
            const wrongSecretToken = jwt.sign({ postmanTeamId: POSTMAN_TEAM_ID, intent: "edit" }, "wrong-secret", {
                algorithm: "HS256"
            });

            await expect(ViewDocsPage(createPageParams({ token: wrongSecretToken }))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });

        it("redirects to login when no app installation exists for team", async () => {
            const token = createValidToken();
            mockGetAppInstallationByTeamId.mockResolvedValue(null);

            await expect(ViewDocsPage(createPageParams({ token }))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });

        it("redirects to login when JWT is malformed", async () => {
            await expect(ViewDocsPage(createPageParams({ token: "not.a.jwt" }))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });

        it("redirects to login when org cannot be resolved from docsUrl (with token)", async () => {
            const token = createValidToken();
            mockGetOrgNameFromDocsUrl.mockResolvedValue(undefined);

            await expect(ViewDocsPage(createPageParams({ token }))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirect).toHaveBeenCalledWith("/login");
            expect(mockAddUserToOrgById).not.toHaveBeenCalled();
        });
    });
});
