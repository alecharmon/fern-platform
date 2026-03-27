import { describe, expect, it } from "vitest";
import { getLoginType, getRelativeTimeString } from "../member-table-utils";

describe("getLoginType", () => {
    it("detects Google login", () => {
        expect(getLoginType("google-oauth2|abc123")).toBe("Google");
    });

    it("detects GitHub login", () => {
        expect(getLoginType("github|abc123")).toBe("GitHub");
    });

    it("detects Postman login", () => {
        expect(getLoginType("oauth2|postman|abc123")).toBe("Postman");
    });

    it("defaults to SSO for SAML", () => {
        expect(getLoginType("samlp|abc123")).toBe("SSO");
    });

    it("defaults to SSO for OIDC", () => {
        expect(getLoginType("oidc|abc123")).toBe("SSO");
    });

    it("defaults to SSO for unknown prefix", () => {
        expect(getLoginType("auth0|abc123")).toBe("SSO");
    });
});

describe("getRelativeTimeString", () => {
    it("returns 'Not logged in' for undefined", () => {
        expect(getRelativeTimeString(undefined)).toBe("Not logged in");
    });

    it("returns relative time for a date string", () => {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        expect(getRelativeTimeString(oneHourAgo)).toMatch(/hour/);
    });
});
