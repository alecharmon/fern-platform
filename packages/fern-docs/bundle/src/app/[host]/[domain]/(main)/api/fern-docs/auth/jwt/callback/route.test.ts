import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fern-api/docs-server/auth/allowed-redirects", () => ({
    getAllowedRedirectUrls: vi.fn().mockReturnValue([])
}));

vi.mock("@fern-api/docs-server/auth/FernJWT", () => ({
    safeVerifyFernJWTConfig: vi.fn()
}));

vi.mock("@fern-api/docs-server/auth/origin", () => ({
    preferPreview: vi.fn((_host: string, domain: string) => domain)
}));

vi.mock("@fern-api/docs-server/auth/return-to", () => ({
    getReturnToQueryParam: vi.fn().mockReturnValue("state")
}));

vi.mock("@fern-api/docs-server/auth/with-secure-cookie", () => ({
    withSecureCookie: vi.fn().mockReturnValue({})
}));

vi.mock("@fern-api/docs-server/FernNextResponse", () => ({
    FernNextResponse: {
        redirect: vi.fn((_req: NextRequest, { destination }: { destination: URL }) =>
            NextResponse.redirect(destination)
        )
    }
}));

vi.mock("@fern-api/docs-server/isLocal", () => ({
    isLocal: vi.fn()
}));

vi.mock("@fern-api/docs-server/isSelfHosted", () => ({
    isSelfHosted: vi.fn().mockReturnValue(false)
}));

vi.mock("@fern-api/docs-server/safeUrl", () => ({
    safeUrl: vi.fn((url: string | null | undefined) => (url ? new URL(url) : undefined))
}));

vi.mock("@fern-api/docs-server/xfernhost/edge", () => ({
    getDocsDomainEdge: vi.fn()
}));

vi.mock("@fern-docs/edge-config", () => ({
    getAuthEdgeConfig: vi.fn()
}));

vi.mock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue({
        set: vi.fn(),
        get: vi.fn()
    })
}));

vi.mock("@/server/redirectWithLoginError", () => ({
    redirectWithLoginError: vi.fn(
        (_req: NextRequest, location: URL | undefined) =>
            new NextResponse(null, {
                status: 302,
                headers: { Location: location?.toString() ?? "" }
            })
    )
}));

import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";

import { GET, POST } from "./route";

const mockSafeVerifyFernJWTConfig = vi.mocked(safeVerifyFernJWTConfig);
const mockIsLocal = vi.mocked(isLocal);
const mockGetDocsDomainEdge = vi.mocked(getDocsDomainEdge);
const mockGetAuthEdgeConfig = vi.mocked(getAuthEdgeConfig);
const mockCookies = vi.mocked(cookies);

const VALID_TOKEN = "valid-jwt-token";

describe("auth/jwt/callback route", () => {
    const mockCookieSet = vi.fn();
    const mockCookieGet = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsLocal.mockReturnValue(false);
        mockGetDocsDomainEdge.mockReturnValue("docs.example.com");
        mockCookieGet.mockReturnValue(undefined);
        mockCookies.mockResolvedValue({ set: mockCookieSet, get: mockCookieGet } as any);
    });

    describe("GET", () => {
        it("should return 400 in local mode", async () => {
            mockIsLocal.mockReturnValue(true);

            const request = new NextRequest(
                "https://docs.example.com/api/fern-docs/auth/jwt/callback?fern_token=token&state=/docs"
            );

            const response = await GET(request);
            expect(response.status).toBe(400);
        });

        it("should redirect and set cookie on valid token", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue({
                name: "Test User",
                email: "test@example.com",
                roles: []
            });

            const request = new NextRequest(
                `https://docs.example.com/api/fern-docs/auth/jwt/callback?fern_token=${VALID_TOKEN}&state=https://docs.example.com/getting-started`
            );

            const response = await GET(request);
            expect(response.status).toBe(307);
            expect(mockCookieSet).toHaveBeenCalledWith("fern_token", VALID_TOKEN, expect.anything());
        });

        it("should return error when no token provided", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);

            const request = new NextRequest(
                "https://docs.example.com/api/fern-docs/auth/jwt/callback?state=https://docs.example.com/getting-started"
            );

            const response = await GET(request);
            expect(response.status).toBe(302);
        });

        it("should return error when token verification fails", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue(undefined);

            const request = new NextRequest(
                `https://docs.example.com/api/fern-docs/auth/jwt/callback?fern_token=invalid-token&state=https://docs.example.com/`
            );

            const response = await GET(request);
            expect(response.status).toBe(302);
        });

        it("should fall back to cookie when no token in search params", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue({
                name: "Test User",
                email: "test@example.com",
                roles: []
            });
            mockCookieGet.mockReturnValue({ value: VALID_TOKEN });

            const request = new NextRequest(
                "https://docs.example.com/api/fern-docs/auth/jwt/callback?state=https://docs.example.com/getting-started"
            );

            const response = await GET(request);
            expect(response.status).toBe(307);
            expect(mockSafeVerifyFernJWTConfig).toHaveBeenCalledWith(VALID_TOKEN, expect.anything());
            expect(mockCookieSet).toHaveBeenCalledWith("fern_token", VALID_TOKEN, expect.anything());
        });

        it("should prefer search param token over cookie token", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue({
                name: "Test User",
                email: "test@example.com",
                roles: []
            });
            mockCookieGet.mockReturnValue({ value: "cookie-token" });

            const request = new NextRequest(
                `https://docs.example.com/api/fern-docs/auth/jwt/callback?fern_token=${VALID_TOKEN}&state=https://docs.example.com/getting-started`
            );

            const response = await GET(request);
            expect(response.status).toBe(307);
            expect(mockSafeVerifyFernJWTConfig).toHaveBeenCalledWith(VALID_TOKEN, expect.anything());
        });
    });

    describe("POST", () => {
        it("should return 400 in local mode", async () => {
            mockIsLocal.mockReturnValue(true);

            const body = new URLSearchParams({ fern_token: VALID_TOKEN, state: "/docs" });
            const request = new NextRequest("https://docs.example.com/api/fern-docs/auth/jwt/callback", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const response = await POST(request);
            expect(response.status).toBe(400);
        });

        it("should accept token and state from form-urlencoded body", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue({
                name: "Test User",
                email: "test@example.com",
                roles: []
            });

            const body = new URLSearchParams({
                fern_token: VALID_TOKEN,
                state: "https://docs.example.com/getting-started"
            });
            const request = new NextRequest("https://docs.example.com/api/fern-docs/auth/jwt/callback", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const response = await POST(request);
            expect(response.status).toBe(307);
            expect(mockSafeVerifyFernJWTConfig).toHaveBeenCalledWith(VALID_TOKEN, expect.anything());
            expect(mockCookieSet).toHaveBeenCalledWith("fern_token", VALID_TOKEN, expect.anything());
        });

        it("should return error when no token in POST body", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);

            const body = new URLSearchParams({ state: "https://docs.example.com/" });
            const request = new NextRequest("https://docs.example.com/api/fern-docs/auth/jwt/callback", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const response = await POST(request);
            expect(response.status).toBe(302);
        });

        it("should return error when POST token verification fails", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue(undefined);

            const body = new URLSearchParams({
                fern_token: "invalid-token",
                state: "https://docs.example.com/"
            });
            const request = new NextRequest("https://docs.example.com/api/fern-docs/auth/jwt/callback", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const response = await POST(request);
            expect(response.status).toBe(302);
        });

        it("should handle POST without state parameter", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue({
                name: "Test User",
                email: "test@example.com",
                roles: []
            });

            const body = new URLSearchParams({ fern_token: VALID_TOKEN });
            const request = new NextRequest("https://docs.example.com/api/fern-docs/auth/jwt/callback", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const response = await POST(request);
            expect(response.status).toBe(307);
            expect(mockCookieSet).toHaveBeenCalledWith("fern_token", VALID_TOKEN, expect.anything());
        });

        it("should fall back to cookie when no token in POST body", async () => {
            mockGetAuthEdgeConfig.mockResolvedValue({
                type: "basic_token_verification"
            } as any);
            mockSafeVerifyFernJWTConfig.mockResolvedValue({
                name: "Test User",
                email: "test@example.com",
                roles: []
            });
            mockCookieGet.mockReturnValue({ value: VALID_TOKEN });

            const body = new URLSearchParams({ state: "https://docs.example.com/getting-started" });
            const request = new NextRequest("https://docs.example.com/api/fern-docs/auth/jwt/callback", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const response = await POST(request);
            expect(response.status).toBe(307);
            expect(mockSafeVerifyFernJWTConfig).toHaveBeenCalledWith(VALID_TOKEN, expect.anything());
            expect(mockCookieSet).toHaveBeenCalledWith("fern_token", VALID_TOKEN, expect.anything());
        });
    });
});
