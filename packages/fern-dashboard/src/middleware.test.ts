import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

const { mockAuth0Middleware } = vi.hoisted(() => ({
    mockAuth0Middleware: vi.fn()
}));

vi.mock("./app/services/auth0/auth0", () => ({
    getAuth0Client: vi.fn().mockResolvedValue({
        middleware: mockAuth0Middleware,
        getSession: vi.fn().mockResolvedValue(null)
    })
}));

vi.mock("./route-permissions", () => ({
    checkRoutePermissions: vi.fn().mockResolvedValue(null)
}));

describe("proxy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth0Middleware.mockResolvedValue(NextResponse.next());
    });

    describe("Postman auth endpoints bypass", () => {
        it("should bypass all middleware for /auth/postman/init", async () => {
            const request = new NextRequest("http://localhost:3000/auth/postman/init", {
                method: "GET"
            });

            const response = await proxy(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
        });

        it("should bypass all middleware for /auth/postman/callback", async () => {
            const request = new NextRequest("http://localhost:3000/auth/postman/callback?jwt=test&state=test", {
                method: "GET"
            });

            const response = await proxy(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
        });

        it("should bypass all middleware for any /auth/postman/* path", async () => {
            const request = new NextRequest("http://localhost:3000/auth/postman/some-other-endpoint", {
                method: "GET"
            });

            const response = await proxy(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
        });

        it("should NOT bypass middleware for /api/auth/refresh", async () => {
            const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
                method: "GET"
            });

            const response = await proxy(request);

            expect(response.headers.get("x-current-path")).toBe("/api/auth/refresh");
        });

        it("should NOT bypass middleware for /api/postman/check", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/check", {
                method: "GET"
            });

            const response = await proxy(request);

            expect(response.headers.get("x-current-path")).toBe("/api/postman/check");
        });
    });

    describe("redirect_on_login cookie handling", () => {
        it("should redirect to the stored URL when redirect_on_login cookie exists", async () => {
            const targetUrl = "/get-started/test-org/docs/details?postman-team-id=123&collection-id=abc";
            const request = new NextRequest("http://localhost:3000/", {
                method: "GET",
                headers: {
                    cookie: `redirect_on_login=${targetUrl}`
                }
            });

            const response = await proxy(request);

            expect(response.status).toBe(307);
            expect(new URL(response.headers.get("location")!).pathname).toBe("/get-started/test-org/docs/details");
            expect(new URL(response.headers.get("location")!).search).toBe("?postman-team-id=123&collection-id=abc");
        });

        it("should consume cookie without redirecting when already at the target URL", async () => {
            const targetUrl = "/get-started/test-org/docs/details?postman-team-id=123&collection-id=abc";
            const request = new NextRequest(`http://localhost:3000${targetUrl}`, {
                method: "GET",
                headers: {
                    cookie: `redirect_on_login=${targetUrl}`
                }
            });

            const response = await proxy(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
            expect(response.headers.get("x-current-path")).toBe(targetUrl);
        });
    });

    describe("auth cookie handling", () => {
        it("does not set pending_org_id on auth login requests", async () => {
            const request = new NextRequest(
                "http://localhost:3000/auth/login?organization=org_123&redirect_on_login=%2Fdocs",
                { method: "GET" }
            );

            const response = await proxy(request);
            const setCookieHeader = response.headers.get("set-cookie") ?? "";

            expect(setCookieHeader).toContain("redirect_on_login=%2Fdocs");
            expect(setCookieHeader).not.toContain("pending_org_id=");
        });

        it("sets redirect_on_login without Secure on localhost http", async () => {
            const request = new NextRequest("http://localhost:3000/auth/login?redirect_on_login=%2Fdocs", {
                method: "GET"
            });

            const response = await proxy(request);
            const setCookieHeader = response.headers.get("set-cookie") ?? "";

            expect(setCookieHeader).toContain("redirect_on_login=%2Fdocs");
            expect(setCookieHeader).not.toContain("Secure");
        });

        it("sets redirect_on_login with Secure over https", async () => {
            const request = new NextRequest("https://example.com/auth/login?redirect_on_login=%2Fdocs", {
                method: "GET"
            });

            const response = await proxy(request);
            const setCookieHeader = response.headers.get("set-cookie") ?? "";

            expect(setCookieHeader).toContain("redirect_on_login=%2Fdocs");
            expect(setCookieHeader).toContain("Secure");
        });

        it("does not persist external redirect_on_login values", async () => {
            const request = new NextRequest(
                "https://example.com/auth/login?redirect_on_login=https%3A%2F%2Fevil.example",
                {
                    method: "GET"
                }
            );

            const response = await proxy(request);
            const setCookieHeader = response.headers.get("set-cookie") ?? "";

            expect(setCookieHeader).not.toContain("redirect_on_login=");
        });

        it("does not persist protocol-relative redirect_on_login values", async () => {
            const request = new NextRequest("https://example.com/auth/login?redirect_on_login=%2F%2Fevil.example", {
                method: "GET"
            });

            const response = await proxy(request);
            const setCookieHeader = response.headers.get("set-cookie") ?? "";

            expect(setCookieHeader).not.toContain("redirect_on_login=");
        });
    });

    describe("silent auth fallback", () => {
        it("retries login using current request params instead of pending_org_id cookie", async () => {
            const request = new NextRequest(
                "https://example.com/auth/login?error=login_required&organization=org_123&connection=example-sso&prompt=none",
                {
                    method: "GET",
                    headers: {
                        cookie: "redirect_on_login=%2Flogin%2Femail%2Fpost-sso-redirect%3Flogin_attempt%3Dattempt-123; pending_org_id=stale-org"
                    }
                }
            );

            const response = await proxy(request);
            const location = response.headers.get("location");
            const redirectUrl = new URL(location ?? "", "https://example.com");

            expect(response.status).toBe(307);
            expect(redirectUrl.pathname).toBe("/auth/login");
            expect(redirectUrl.searchParams.get("organization")).toBe("org_123");
            expect(redirectUrl.searchParams.get("connection")).toBe("example-sso");
            expect(redirectUrl.searchParams.get("redirect_on_login")).toBe(
                "/login/email/post-sso-redirect?login_attempt=attempt-123"
            );
        });

        it("does not replay external redirect_on_login values from query or cookie", async () => {
            const request = new NextRequest(
                "https://example.com/auth/login?error=login_required&redirect_on_login=https%3A%2F%2Fevil.example",
                {
                    method: "GET",
                    headers: {
                        cookie: "redirect_on_login=https%3A%2F%2Fevil.example"
                    }
                }
            );

            const response = await proxy(request);
            const location = response.headers.get("location");
            const redirectUrl = new URL(location ?? "", "https://example.com");

            expect(redirectUrl.pathname).toBe("/auth/login");
            expect(redirectUrl.searchParams.get("redirect_on_login")).toBeNull();
        });

        it("does not replay protocol-relative redirect_on_login values from query or cookie", async () => {
            const request = new NextRequest(
                "https://example.com/auth/login?error=login_required&redirect_on_login=%2F%2Fevil.example",
                {
                    method: "GET",
                    headers: {
                        cookie: "redirect_on_login=%2F%2Fevil.example"
                    }
                }
            );

            const response = await proxy(request);
            const location = response.headers.get("location");
            const redirectUrl = new URL(location ?? "", "https://example.com");

            expect(redirectUrl.pathname).toBe("/auth/login");
            expect(redirectUrl.searchParams.get("redirect_on_login")).toBeNull();
        });
    });
});
