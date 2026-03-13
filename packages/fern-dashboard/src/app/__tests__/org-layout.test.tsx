// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

const mocks = vi.hoisted(() => ({
    mockGetCurrentSession: vi.fn(),
    mockDoesOrgExist: vi.fn(),
    mockCreateIsFernOrgMemberChecker: vi.fn(),
    mockGetOrgIdFromName: vi.fn(),
    mockGetAvailableOrgsForUser: vi.fn(),
    mockRedirect: vi.fn((url: string) => {
        const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string };
        error.digest = `NEXT_REDIRECT;${url}`;
        throw error;
    }),
    mockHeaders: vi.fn()
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
    headers: mocks.mockHeaders
}));

vi.mock("next/navigation", () => ({
    redirect: mocks.mockRedirect
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: mocks.mockGetCurrentSession
}));

vi.mock("@/app/services/auth0/management", () => ({
    createIsFernOrgMemberChecker: mocks.mockCreateIsFernOrgMemberChecker,
    doesOrgExist: mocks.mockDoesOrgExist,
    FERN_ORG_NAME: "fern",
    getOrgIdFromName: mocks.mockGetOrgIdFromName
}));

vi.mock("@/app/services/dal/fdr/getAvailableOrgsForUser", () => ({
    getAvailableOrgsForUser: mocks.mockGetAvailableOrgsForUser
}));

vi.mock("@/components/auth/TokenRefresher", () => ({
    TokenRefresher: () => <div data-testid="token-refresher" />
}));

vi.mock("@/components/layout/OrgNotFoundLayout", () => ({
    OrgNotFoundLayout: ({ orgName }: { orgName: string }) => (
        <div data-testid="org-not-found-layout" data-org-name={orgName} />
    )
}));

vi.mock("@/utils/orgRedirect", () => ({
    __esModule: true,
    default: vi.fn(
        (org: { id: string; name: string }, pathname: string) =>
            `/auth/login?redirect_on_login=${org.name}${pathname}&organization=${org.id}`
    )
}));

import OrgLayout from "../[orgName]/layout";

describe("OrgLayout", () => {
    const nonexistentOrg = "fake-nonexistent-org-xyz" as Auth0OrgName;
    const existingOrg = "real-org" as Auth0OrgName;

    const mockSession = {
        user: { sub: "auth0|user-123" as Auth0UserID },
        accessToken: "mock-access-token",
        permissions: ["super-user"],
        orgId: "org_real"
    };

    const mockRegularSession = {
        user: { sub: "auth0|user-456" as Auth0UserID },
        accessToken: "mock-access-token",
        permissions: [],
        orgId: "org_real"
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockHeaders.mockResolvedValue({
            get: () => ""
        });
    });

    it("shows OrgNotFoundLayout for a nonexistent org when user is a super-user", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(mockSession);
        mocks.mockDoesOrgExist.mockResolvedValue(false);

        const result = await OrgLayout({
            params: Promise.resolve({ orgName: nonexistentOrg }),
            children: <div>children</div>
        });

        expect(result).toBeDefined();
        expect((result as any).props.orgName).toBe(nonexistentOrg);
        expect(mocks.mockDoesOrgExist).toHaveBeenCalledWith(nonexistentOrg);
    });

    it("shows OrgNotFoundLayout for a nonexistent org when user is a regular user", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(mockRegularSession);
        mocks.mockGetAvailableOrgsForUser.mockResolvedValue([]);
        mocks.mockCreateIsFernOrgMemberChecker.mockResolvedValue(() => false);

        const result = await OrgLayout({
            params: Promise.resolve({ orgName: nonexistentOrg }),
            children: <div>children</div>
        });

        expect(result).toBeDefined();
        expect((result as any).props.orgName).toBe(nonexistentOrg);
        expect(mocks.mockDoesOrgExist).not.toHaveBeenCalled();
    });

    it("renders children when org exists and user is a super-user", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(mockSession);
        mocks.mockDoesOrgExist.mockResolvedValue(true);

        const result = await OrgLayout({
            params: Promise.resolve({ orgName: existingOrg }),
            children: <div data-testid="page-content">children</div>
        });

        expect(result).toBeDefined();
        const fragment = result as any;
        expect(fragment.props.children).toBeDefined();
    });

    it("renders children for unauthenticated users (login handled downstream)", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(null);

        const result = await OrgLayout({
            params: Promise.resolve({ orgName: nonexistentOrg }),
            children: <div data-testid="page-content">children</div>
        });

        expect(result).toBeDefined();
        expect(mocks.mockDoesOrgExist).not.toHaveBeenCalled();
    });

    it("does not call doesOrgExist for non-super-users", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(mockRegularSession);
        mocks.mockGetAvailableOrgsForUser.mockResolvedValue([{ id: "org_real", name: existingOrg }]);

        await OrgLayout({
            params: Promise.resolve({ orgName: existingOrg }),
            children: <div>children</div>
        });

        expect(mocks.mockDoesOrgExist).not.toHaveBeenCalled();
    });

    it("does not call doesOrgExist when user is not authenticated", async () => {
        mocks.mockGetCurrentSession.mockResolvedValue(null);

        await OrgLayout({
            params: Promise.resolve({ orgName: nonexistentOrg }),
            children: <div>children</div>
        });

        expect(mocks.mockDoesOrgExist).not.toHaveBeenCalled();
    });
});
