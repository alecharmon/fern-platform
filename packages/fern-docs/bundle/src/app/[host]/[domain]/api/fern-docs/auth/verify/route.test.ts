import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fern-api/docs-server/auth/FernJWT", () => ({
    safeVerifyFernJWTWithMultipleConfigs: vi.fn()
}));

vi.mock("@fern-api/docs-server/isLocal", () => ({
    isLocal: vi.fn()
}));

vi.mock("@fern-api/docs-server/isSelfHosted", () => ({
    isSelfHosted: vi.fn()
}));

vi.mock("@fern-api/docs-server/xfernhost/edge", () => ({
    getDocsDomainEdge: vi.fn()
}));

vi.mock("@fern-docs/edge-config", () => ({
    getAuthEdgeConfigs: vi.fn()
}));

vi.mock("next/headers", () => ({
    cookies: vi.fn()
}));

import { safeVerifyFernJWTWithMultipleConfigs } from "@fern-api/docs-server/auth/FernJWT";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { getAuthEdgeConfigs } from "@fern-docs/edge-config";

import { POST } from "./route";

const mockSafeVerifyFernJWTWithMultipleConfigs = vi.mocked(safeVerifyFernJWTWithMultipleConfigs);
const mockIsLocal = vi.mocked(isLocal);
const mockIsSelfHosted = vi.mocked(isSelfHosted);
const mockGetDocsDomainEdge = vi.mocked(getDocsDomainEdge);
const mockGetAuthEdgeConfigs = vi.mocked(getAuthEdgeConfigs);

describe("auth/verify route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsLocal.mockReturnValue(false);
        mockIsSelfHosted.mockReturnValue(false);
        mockGetDocsDomainEdge.mockReturnValue("buildwithfern.com");
    });

    it("should return error in local mode", async () => {
        mockIsLocal.mockReturnValue(true);

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST"
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({
            authenticated: false,
            error: "Authentication verification is not available in local preview mode or self-hosted mode"
        });
    });

    it("should return error in self-hosted mode", async () => {
        mockIsSelfHosted.mockReturnValue(true);

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST"
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({
            authenticated: false,
            error: "Authentication verification is not available in local preview mode or self-hosted mode"
        });
    });

    it("should return authenticated false when no token provided", async () => {
        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST"
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            authenticated: false
        });
    });

    it("should return authenticated false when no auth config found", async () => {
        mockGetAuthEdgeConfigs.mockResolvedValue([]);

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST",
            headers: {
                FERN_TOKEN: "test-token"
            }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            authenticated: false
        });
    });

    it("should return authenticated false when token verification fails", async () => {
        mockGetAuthEdgeConfigs.mockResolvedValue([
            {
                type: "basic_token_verification"
            } as any
        ]);
        mockSafeVerifyFernJWTWithMultipleConfigs.mockResolvedValue(undefined);

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST",
            headers: {
                FERN_TOKEN: "invalid-token"
            }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            authenticated: false
        });
    });

    it("should return user info with basic_token_verification", async () => {
        mockGetAuthEdgeConfigs.mockResolvedValue([
            {
                type: "basic_token_verification"
            } as any
        ]);
        mockSafeVerifyFernJWTWithMultipleConfigs.mockResolvedValue({
            name: "John Doe",
            email: "john@example.com",
            roles: ["admin", "viewer"]
        });

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST",
            headers: {
                FERN_TOKEN: "valid-token"
            }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            authenticated: true,
            user: {
                name: "John Doe",
                email: "john@example.com",
                roles: ["admin", "viewer"]
            }
        });
    });

    it("should return user info with oauth2 partner", async () => {
        mockGetAuthEdgeConfigs.mockResolvedValue([
            {
                type: "oauth2",
                partner: "google"
            } as any
        ]);
        mockSafeVerifyFernJWTWithMultipleConfigs.mockResolvedValue({
            name: "Jane Smith",
            email: "jane@example.com",
            roles: ["user"]
        });

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST",
            headers: {
                FERN_TOKEN: "valid-oauth-token"
            }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            authenticated: true,
            user: {
                name: "Jane Smith",
                email: "jane@example.com",
                roles: ["user"]
            }
        });
    });

    it("should return user info with workos SSO", async () => {
        mockGetAuthEdgeConfigs.mockResolvedValue([
            {
                type: "sso",
                partner: "workos"
            } as any
        ]);
        mockSafeVerifyFernJWTWithMultipleConfigs.mockResolvedValue({
            name: "Bob Johnson",
            email: "bob@company.com",
            roles: ["employee"]
        });

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST",
            headers: {
                FERN_TOKEN: "valid-sso-token"
            }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
            authenticated: true,
            user: {
                name: "Bob Johnson",
                email: "bob@company.com",
                roles: ["employee"]
            }
        });
    });

    it("should extract token from cookies when header not present", async () => {
        mockGetAuthEdgeConfigs.mockResolvedValue([
            {
                type: "basic_token_verification"
            } as any
        ]);
        mockSafeVerifyFernJWTWithMultipleConfigs.mockResolvedValue({
            name: "Cookie User",
            email: "cookie@example.com",
            roles: []
        });

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST",
            headers: {
                Cookie: "fern_token=cookie-token"
            }
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.authenticated).toBe(true);
        expect(data.user?.name).toBe("Cookie User");
    });

    it("should return 500 error when exception occurs", async () => {
        mockGetDocsDomainEdge.mockImplementation(() => {
            throw new Error("Test error");
        });

        const request = new NextRequest("https://example.com/api/fern-docs/auth/verify", {
            method: "POST"
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({
            authenticated: false,
            error: "Internal server error"
        });
    });
});
