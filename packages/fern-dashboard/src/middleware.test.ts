import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { middleware } from "./middleware";

vi.mock("./app/services/auth0/auth0", () => ({
    getAuth0Client: vi.fn().mockResolvedValue({
        middleware: vi.fn().mockResolvedValue(NextResponse.next()),
        getSession: vi.fn().mockResolvedValue(null)
    })
}));

vi.mock("./route-permissions", () => ({
    checkRoutePermissions: vi.fn().mockResolvedValue(null)
}));

describe("middleware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Postman auth endpoints bypass", () => {
        it("should bypass all middleware for /auth/postman/init", async () => {
            const request = new NextRequest("http://localhost:3000/auth/postman/init", {
                method: "GET"
            });

            const response = await middleware(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
        });

        it("should bypass all middleware for /auth/postman/callback", async () => {
            const request = new NextRequest("http://localhost:3000/auth/postman/callback?jwt=test&state=test", {
                method: "GET"
            });

            const response = await middleware(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
        });

        it("should bypass all middleware for any /auth/postman/* path", async () => {
            const request = new NextRequest("http://localhost:3000/auth/postman/some-other-endpoint", {
                method: "GET"
            });

            const response = await middleware(request);

            expect(response.status).toBe(200);
            expect(response.headers.get("x-middleware-next")).toBe("1");
        });

        it("should NOT bypass middleware for /api/auth/refresh", async () => {
            const request = new NextRequest("http://localhost:3000/api/auth/refresh", {
                method: "GET"
            });

            const response = await middleware(request);

            expect(response.headers.get("x-current-path")).toBe("/api/auth/refresh");
        });

        it("should NOT bypass middleware for /api/postman/check", async () => {
            const request = new NextRequest("http://localhost:3000/api/postman/check", {
                method: "GET"
            });

            const response = await middleware(request);

            expect(response.headers.get("x-current-path")).toBe("/api/postman/check");
        });
    });
});
