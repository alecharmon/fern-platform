import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@fern-platform/service-jwt-auth", () => ({
    verifyServiceJwt: vi.fn()
}));

import * as serviceJwtAuth from "@fern-platform/service-jwt-auth";
import { err, ok } from "neverthrow";

import { authenticateServiceJwt } from "../_utils/authenticateServiceJwt";

const mockVerifyServiceJwt = serviceJwtAuth.verifyServiceJwt as Mock;

function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request("https://example.com/api/services/activity-log/activity", {
        method: "POST",
        headers
    });
}

describe("authenticateServiceJwt", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when authorization header is missing", async () => {
        const result = await authenticateServiceJwt(makeRequest());
        expect(result).toBeInstanceOf(NextResponse);
        const response = result as NextResponse;
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("Authorization header required");
    });

    it("returns payload on valid Bearer token", async () => {
        const payload = { service: "fai", iss: "https://buildwithfern.com", aud: "dashboard-activity-log" };
        mockVerifyServiceJwt.mockResolvedValue(ok(payload));

        const result = await authenticateServiceJwt(makeRequest({ authorization: "Bearer valid-token" }));

        expect(result).toEqual(payload);
        expect(mockVerifyServiceJwt).toHaveBeenCalledWith("valid-token", {
            issuer: "https://buildwithfern.com",
            audience: "dashboard-activity-log"
        });
    });

    it("returns 401 when token verification fails", async () => {
        mockVerifyServiceJwt.mockResolvedValue(
            err({ source: "service-jwt-auth", code: "INVALID_TOKEN", message: "bad token" })
        );

        const result = await authenticateServiceJwt(makeRequest({ authorization: "Bearer bad-token" }));

        expect(result).toBeInstanceOf(NextResponse);
        const response = result as NextResponse;
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBe("bad token");
    });

    it("strips Bearer prefix case-insensitively", async () => {
        const payload = { service: "fai" };
        mockVerifyServiceJwt.mockResolvedValue(ok(payload));

        await authenticateServiceJwt(makeRequest({ authorization: "BEARER my-token" }));

        expect(mockVerifyServiceJwt).toHaveBeenCalledWith("my-token", expect.any(Object));
    });
});
