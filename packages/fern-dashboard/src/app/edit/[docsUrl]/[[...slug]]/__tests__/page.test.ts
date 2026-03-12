// @vitest-environment node
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

// Mock Next.js headers
const mockHeadersMap = new Map<string, string>();
vi.mock("next/headers", () => ({
    headers: vi.fn(async () => ({
        get: (name: string) => mockHeadersMap.get(name) ?? null
    }))
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
    revalidateTag: vi.fn()
}));

vi.mock("@/app/api/utils/getDocsUrlMetadata", () => ({
    getDocsUrlMetadata: vi.fn()
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: vi.fn()
}));

vi.mock("@/app/services/auth0/redirectToLogin", () => ({
    redirectToLogin: vi.fn(() => {
        const error = new Error("NEXT_REDIRECT: /login") as Error & { digest: string };
        error.digest = "NEXT_REDIRECT;/login";
        throw error;
    })
}));

vi.mock("@/app/services/dal/organization", () => ({
    assertUserHasOrganizationAccess: vi.fn()
}));

import { redirect } from "next/navigation";
import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { redirectToLogin } from "@/app/services/auth0/redirectToLogin";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

import EditDocsUrlPage from "../page";

const mockRedirect = redirect as unknown as Mock;
const mockGetDocsUrlMetadata = getDocsUrlMetadata as Mock;
const mockGetCurrentSession = getCurrentSession as Mock;
const mockRedirectToLogin = redirectToLogin as unknown as Mock;
const mockAssertUserHasOrganizationAccess = assertUserHasOrganizationAccess as Mock;

const DOCS_URL = "docs.example.com";
const ORG_NAME = "test-org";
const USER_SUB = "auth0|user-123";
const USER_NAME = "Test User";
const ACCESS_TOKEN = "mock-access-token";

const mockSession = {
    user: { sub: USER_SUB, name: USER_NAME },
    accessToken: ACCESS_TOKEN
};

function createPageParams(docsUrl: string, slug?: string[]) {
    return {
        params: Promise.resolve(slug != null ? { docsUrl, slug } : { docsUrl })
    };
}

describe("EditDocsUrlPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHeadersMap.clear();

        mockGetCurrentSession.mockResolvedValue(mockSession);
        mockGetDocsUrlMetadata.mockResolvedValue({
            ok: true,
            body: { org: ORG_NAME, url: DOCS_URL, isPreviewUrl: false }
        });
        mockAssertUserHasOrganizationAccess.mockResolvedValue(undefined);
    });

    describe("slug handling", () => {
        it("redirects to editor with ROOT_SLUG_ALIAS when no slug is provided", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL))).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/editor/");
            expect(redirectUrl).toMatch(/\/root$/);
        });

        it("redirects to editor with ROOT_SLUG_ALIAS when slug is empty array", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL, []))).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toMatch(/\/root$/);
        });

        it("redirects to editor with single slug segment", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL, ["welcome"]))).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain("/editor/");
            expect(redirectUrl).toMatch(/\/welcome$/);
        });

        it("redirects to editor with multi-segment slug joined by /", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL, ["docs", "getting-started"]))).rejects.toThrow(
                "NEXT_REDIRECT"
            );

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toMatch(/\/docs\/getting-started$/);
        });
    });

    describe("domain resolution", () => {
        it("uses fallback domain param when x-current-path header is absent", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL, ["welcome"]))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockGetDocsUrlMetadata).toHaveBeenCalledWith({
                url: DOCS_URL,
                token: ACCESS_TOKEN
            });
        });

        it("resolves domain from x-current-path header preserving encoded basepath", async () => {
            mockHeadersMap.set("x-current-path", "/edit/docs.example.com%2Flearn/welcome");

            await expect(EditDocsUrlPage(createPageParams("docs.example.com/learn", ["welcome"]))).rejects.toThrow(
                "NEXT_REDIRECT"
            );

            // The domain should be decoded from the raw header
            expect(mockGetDocsUrlMetadata).toHaveBeenCalledWith({
                url: "docs.example.com/learn",
                token: ACCESS_TOKEN
            });
        });

        it("resolves domain from x-current-path header when no slug present", async () => {
            mockHeadersMap.set("x-current-path", "/edit/docs.example.com%2Flearn");

            await expect(EditDocsUrlPage(createPageParams("docs.example.com/learn"))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockGetDocsUrlMetadata).toHaveBeenCalledWith({
                url: "docs.example.com/learn",
                token: ACCESS_TOKEN
            });

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toMatch(/\/root$/);
        });

        it("strips query string from x-current-path before parsing", async () => {
            mockHeadersMap.set("x-current-path", "/edit/docs.example.com?foo=bar");

            await expect(EditDocsUrlPage(createPageParams(DOCS_URL))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockGetDocsUrlMetadata).toHaveBeenCalledWith({
                url: DOCS_URL,
                token: ACCESS_TOKEN
            });
        });
    });

    describe("authentication", () => {
        it("redirects to login when session is null", async () => {
            mockGetCurrentSession.mockResolvedValue(null);

            await expect(EditDocsUrlPage(createPageParams(DOCS_URL))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockRedirectToLogin).toHaveBeenCalled();
        });
    });

    describe("authorization", () => {
        it("redirects to error page when docs URL metadata lookup fails", async () => {
            mockGetDocsUrlMetadata.mockResolvedValue({
                ok: false,
                error: { error: "DomainNotRegisteredError" }
            });

            await expect(EditDocsUrlPage(createPageParams(DOCS_URL))).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toBe("/error?message=Docs+site+not+found");
        });

        it("verifies user has organization access", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL))).rejects.toThrow("NEXT_REDIRECT");

            expect(mockAssertUserHasOrganizationAccess).toHaveBeenCalledWith(ACCESS_TOKEN, ORG_NAME);
        });
    });

    describe("editor URL construction", () => {
        it("constructs correct editor URL with org, encoded domain, branch, and slug", async () => {
            await expect(EditDocsUrlPage(createPageParams(DOCS_URL, ["welcome"]))).rejects.toThrow("NEXT_REDIRECT");

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;

            // URL format: /${orgName}/editor/${encodedDocsUrl}/${branchName}/${slug}
            expect(redirectUrl).toMatch(new RegExp(`^/${ORG_NAME}/editor/`));
            expect(redirectUrl).toContain(encodeURIComponent(DOCS_URL));
            expect(redirectUrl).toMatch(/\/welcome$/);
        });

        it("encodes domain with basepath in editor URL", async () => {
            const domainWithBasepath = "docs.example.com/learn";
            mockHeadersMap.set("x-current-path", "/edit/docs.example.com%2Flearn/welcome");

            await expect(EditDocsUrlPage(createPageParams(domainWithBasepath, ["welcome"]))).rejects.toThrow(
                "NEXT_REDIRECT"
            );

            const redirectUrl = mockRedirect.mock.calls[0]?.[0] as string;
            expect(redirectUrl).toContain(encodeURIComponent(domainWithBasepath));
        });
    });
});
