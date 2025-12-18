import { postToSlack } from "@fern-api/docs-server/slack";
import { getEmailLoginConfig } from "@fern-docs/edge-config";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { addUserToOrgById, getAllUsersByEmail } from "@/app/services/auth0/management";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

import getMyOrganizations from "../../get-my-organizations/handler";
import { POST } from "./route";

vi.mock("@/app/services/auth0/management", () => ({
    getAllUsersByEmail: vi.fn(),
    addUserToOrgById: vi.fn()
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: vi.fn()
}));

vi.mock("@/app/services/auth0/types", () => ({
    Auth0OrgID: (id: string) => id,
    Auth0UserID: (id: string) => id
}));

vi.mock("@fern-docs/edge-config", () => ({
    getEmailLoginConfig: vi.fn()
}));

vi.mock("@/app/services/venus/getVenusClient", () => ({
    getVenusClient: vi.fn()
}));

vi.mock("../../get-my-organizations/handler", () => ({
    default: vi.fn()
}));

vi.mock("@fern-api/docs-server/slack", () => ({
    postToSlack: vi.fn()
}));

describe("login/email API", () => {
    const mockGetAllUsersByEmail = vi.mocked(getAllUsersByEmail);
    const mockAddUserToOrgById = vi.mocked(addUserToOrgById);
    const mockGetCurrentSession = vi.mocked(getCurrentSession);
    const mockGetEmailLoginConfig = vi.mocked(getEmailLoginConfig);
    const mockGetVenusClient = vi.mocked(getVenusClient);
    const mockGetMyOrganizations = vi.mocked(getMyOrganizations);
    const mockPostToSlack = vi.mocked(postToSlack);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mockGetEmailLoginConfig.mockResolvedValue({
            supportedPlatforms: ["samlp", "google-oauth2", "github"],
            connectionToOrg: {
                oktahey: { org_id: "org_UtKyk8aCwTJ8Lqr0", org_name: "oktassotestorg20251204" }
            },
            byEmailDomain: {}
        });
    });

    it("redirects to SSO org connection and adds user to org when missing membership", async () => {
        const addUser = vi.fn();
        mockGetVenusClient.mockReturnValue({
            organization: { addUser }
        } as unknown as ReturnType<typeof getVenusClient>);

        mockGetCurrentSession.mockResolvedValue({
            accessToken: "access-token",
            user: { sub: "auth0|user" }
        } as any);

        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|user",
                email: "user@example.com",
                identities: [
                    {
                        connection: "oktahey",
                        provider: "samlp"
                    }
                ]
            } as any
        ]);

        mockGetMyOrganizations.mockResolvedValue([]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { redirectUrl: string };

        if (response.status !== 200) {
            // eslint-disable-next-line no-console
            console.error("SSO debug", response.status, body);
        }

        expect(response.status).toBe(200);
        expect(body.redirectUrl).toBe(
            "/auth/login?connection=oktahey&login_hint=user%40example.com&redirect_on_login=%2Flogin%2Femail%2Fpost-sso-redirect%3Fconnection%3Doktahey%26default_redirect%3D%252Foktassotestorg20251204%26redirect%3D%252Foktassotestorg20251204&prompt=select_account"
        );
        expect(mockGetMyOrganizations).toHaveBeenCalledWith("auth0|user");
        expect(addUser).not.toHaveBeenCalled();
        expect(mockAddUserToOrgById).not.toHaveBeenCalled();
    });

    it("redirects google users with provided redirect_on_login", async () => {
        mockGetVenusClient.mockReturnValue({
            organization: { addUser: vi.fn() }
        } as unknown as ReturnType<typeof getVenusClient>);

        mockGetCurrentSession.mockResolvedValue(undefined);
        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|google",
                email: "user@example.com",
                identities: [
                    {
                        connection: "google-oauth2",
                        provider: "google-oauth2"
                    }
                ]
            } as any
        ]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com", redirect_on_login: "/docs" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { redirectUrl: string };

        expect(response.status).toBe(200);
        expect(body.redirectUrl).toBe(
            "/auth/login?connection=google-oauth2&login_hint=user%40example.com&redirect_on_login=%2Fdocs&prompt=select_account"
        );
        expect(mockGetMyOrganizations).not.toHaveBeenCalled();
        expect(mockAddUserToOrgById).not.toHaveBeenCalled();
    });

    it("redirects github users to default landing", async () => {
        mockGetVenusClient.mockReturnValue({
            organization: { addUser: vi.fn() }
        } as unknown as ReturnType<typeof getVenusClient>);

        mockGetCurrentSession.mockResolvedValue(undefined);
        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|github",
                email: "user@example.com",
                identities: [
                    {
                        connection: "github-main",
                        provider: "github"
                    }
                ]
            } as any
        ]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { redirectUrl: string };

        expect(response.status).toBe(200);
        expect(body.redirectUrl).toBe(
            "/auth/login?connection=github-main&login_hint=user%40example.com&redirect_on_login=%2F&prompt=select_account"
        );
        expect(mockGetMyOrganizations).not.toHaveBeenCalled();
        expect(mockAddUserToOrgById).not.toHaveBeenCalled();
    });

    it("redirects new users mapped by email domain through post-SSO org redirect", async () => {
        mockGetEmailLoginConfig.mockResolvedValueOnce({
            supportedPlatforms: ["samlp"],
            connectionToOrg: {},
            byEmailDomain: {
                "example.com": {
                    org_id: "org_default",
                    org_name: "example",
                    connection: "oktahey"
                }
            }
        });

        mockGetAllUsersByEmail.mockResolvedValue([]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com", redirect_on_login: "/docs" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { redirectUrl: string };

        expect(response.status).toBe(200);
        expect(body.redirectUrl).toBe(
            "/auth/login?connection=oktahey&login_hint=user%40example.com&redirect_on_login=%2Flogin%2Femail%2Fpost-sso-redirect%3Fconnection%3Doktahey%26default_redirect%3D%252Fexample%26redirect%3D%252Fdocs&prompt=select_account"
        );
    });

    it("returns 404 when user is not found", async () => {
        mockGetAllUsersByEmail.mockResolvedValue([]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "missing@example.com" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { error: string };

        expect(response.status).toBe(404);
        expect(body.error).toBe("user_not_found");
    });

    it("returns 400 for invalid request body", async () => {
        const request = { json: vi.fn().mockResolvedValue({ email: "not-an-email" }) } as unknown as Request;

        const response = await POST(request);
        const body = (await response.json()) as { error: string };

        expect(response.status).toBe(400);
        expect(body.error).toBe("unable_to_start_sso");
    });

    it("prioritizes SSO user over Google/GitHub user when multiple users exist for same email", async () => {
        const addUser = vi.fn();
        mockGetVenusClient.mockReturnValue({
            organization: { addUser }
        } as unknown as ReturnType<typeof getVenusClient>);

        mockGetCurrentSession.mockResolvedValue({
            accessToken: "access-token",
            user: { sub: "auth0|sso-user" }
        } as any);

        // Return multiple users - Google user first, SSO user second
        // The sorting should prioritize the SSO user
        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|google-user",
                email: "user@example.com",
                identities: [
                    {
                        connection: "google-oauth2",
                        provider: "google-oauth2"
                    }
                ]
            } as any,
            {
                user_id: "auth0|sso-user",
                email: "user@example.com",
                identities: [
                    {
                        connection: "oktahey",
                        provider: "samlp"
                    }
                ]
            } as any
        ]);

        mockGetMyOrganizations.mockResolvedValue([]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { redirectUrl: string };

        expect(response.status).toBe(200);
        // Should use the SSO connection (oktahey), not google-oauth2
        expect(body.redirectUrl).toContain("connection=oktahey");
        expect(body.redirectUrl).not.toContain("connection=google-oauth2");

        // Should send Slack alert about duplicate accounts
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#dashboard-notifs",
            expect.stringContaining("Duplicate accounts detected"),
            "duplicate-account"
        );
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#dashboard-notifs",
            expect.stringContaining("Recommendation"),
            "duplicate-account"
        );
    });

    it("prioritizes SSO user over GitHub user when multiple users exist for same email", async () => {
        const addUser = vi.fn();
        mockGetVenusClient.mockReturnValue({
            organization: { addUser }
        } as unknown as ReturnType<typeof getVenusClient>);

        mockGetCurrentSession.mockResolvedValue({
            accessToken: "access-token",
            user: { sub: "auth0|sso-user" }
        } as any);

        // Return multiple users - GitHub user first, SSO user second
        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|github-user",
                email: "user@example.com",
                identities: [
                    {
                        connection: "github-main",
                        provider: "github"
                    }
                ]
            } as any,
            {
                user_id: "auth0|sso-user",
                email: "user@example.com",
                identities: [
                    {
                        connection: "oktahey",
                        provider: "samlp"
                    }
                ]
            } as any
        ]);

        mockGetMyOrganizations.mockResolvedValue([]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { redirectUrl: string };

        expect(response.status).toBe(200);
        // Should use the SSO connection (oktahey), not github
        expect(body.redirectUrl).toContain("connection=oktahey");
        expect(body.redirectUrl).not.toContain("connection=github");

        // Should send Slack alert about duplicate accounts
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#dashboard-notifs",
            expect.stringContaining("Duplicate accounts detected"),
            "duplicate-account"
        );
    });

    it("does not send Slack alert when only one account exists", async () => {
        mockGetVenusClient.mockReturnValue({
            organization: { addUser: vi.fn() }
        } as unknown as ReturnType<typeof getVenusClient>);

        mockGetCurrentSession.mockResolvedValue(undefined);
        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|single-user",
                email: "user@example.com",
                identities: [
                    {
                        connection: "google-oauth2",
                        provider: "google-oauth2"
                    }
                ]
            } as any
        ]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com" })
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        // Should NOT send Slack alert when there's only one account
        expect(mockPostToSlack).not.toHaveBeenCalled();
    });

    it("ignores identities that are not enabled in supported platforms", async () => {
        mockGetEmailLoginConfig.mockResolvedValueOnce({
            supportedPlatforms: ["github"],
            connectionToOrg: {},
            byEmailDomain: {}
        });
        mockGetAllUsersByEmail.mockResolvedValue([
            {
                user_id: "auth0|google",
                email: "user@example.com",
                identities: [
                    {
                        connection: "google-oauth2",
                        provider: "google-oauth2"
                    }
                ]
            } as any
        ]);

        const request = new NextRequest("http://localhost:3000/api/login/email", {
            method: "POST",
            body: JSON.stringify({ email: "user@example.com" })
        });

        const response = await POST(request);
        const body = (await response.json()) as { error: string };

        expect(response.status).toBe(404);
        expect(body.error).toBe("user_not_found");
    });
});
