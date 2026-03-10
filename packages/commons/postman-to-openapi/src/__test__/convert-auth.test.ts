import { describe, expect, it } from "vitest";

import { convertAuth } from "../convert-auth.js";

describe("convertAuth", () => {
    it("returns empty for null auth", () => {
        const result = convertAuth(null);
        expect(result.securitySchemes).toEqual({});
        expect(result.security).toEqual([]);
    });

    it("returns empty for noauth", () => {
        const result = convertAuth({ type: "noauth" });
        expect(result.securitySchemes).toEqual({});
        expect(result.security).toEqual([]);
    });

    it("converts bearer auth", () => {
        const result = convertAuth({
            type: "bearer",
            bearer: [{ key: "token", value: "abc123" }]
        });
        expect(result.securitySchemes.bearerAuth).toEqual({
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
        });
        expect(result.security).toEqual([{ bearerAuth: [] }]);
    });

    it("converts basic auth", () => {
        const result = convertAuth({
            type: "basic",
            basic: [
                { key: "username", value: "user" },
                { key: "password", value: "pass" }
            ]
        });
        expect(result.securitySchemes.basicAuth).toEqual({
            type: "http",
            scheme: "basic"
        });
        expect(result.security).toEqual([{ basicAuth: [] }]);
    });

    it("converts API key auth with defaults", () => {
        const result = convertAuth({
            type: "apikey",
            apikey: []
        });
        expect(result.securitySchemes.apiKeyAuth).toEqual({
            type: "apiKey",
            name: "X-API-Key",
            in: "header"
        });
    });

    it("converts API key auth with custom key and location", () => {
        const result = convertAuth({
            type: "apikey",
            apikey: [
                { key: "key", value: "X-Custom-Key" },
                { key: "in", value: "query" }
            ]
        });
        expect(result.securitySchemes.apiKeyAuth).toEqual({
            type: "apiKey",
            name: "X-Custom-Key",
            in: "query"
        });
    });

    it("converts OAuth2 authorization_code flow", () => {
        const result = convertAuth({
            type: "oauth2",
            oauth2: [
                { key: "grant_type", value: "authorization_code" },
                { key: "authUrl", value: "https://auth.example.com/authorize" },
                { key: "accessTokenUrl", value: "https://auth.example.com/token" },
                { key: "scope", value: "read write" }
            ]
        });
        expect(result.securitySchemes.oauth2Auth).toEqual({
            type: "oauth2",
            flows: {
                authorizationCode: {
                    authorizationUrl: "https://auth.example.com/authorize",
                    tokenUrl: "https://auth.example.com/token",
                    scopes: { read: "", write: "" }
                }
            }
        });
    });

    it("converts OAuth2 client_credentials flow", () => {
        const result = convertAuth({
            type: "oauth2",
            oauth2: [
                { key: "grant_type", value: "client_credentials" },
                { key: "accessTokenUrl", value: "https://auth.example.com/token" }
            ]
        });
        expect(result.securitySchemes.oauth2Auth?.flows?.clientCredentials).toBeDefined();
    });

    it("converts OAuth2 implicit flow", () => {
        const result = convertAuth({
            type: "oauth2",
            oauth2: [
                { key: "grant_type", value: "implicit" },
                { key: "authUrl", value: "https://auth.example.com/authorize" }
            ]
        });
        expect(result.securitySchemes.oauth2Auth?.flows?.implicit).toBeDefined();
    });

    it("converts OAuth2 password flow", () => {
        const result = convertAuth({
            type: "oauth2",
            oauth2: [
                { key: "grant_type", value: "password_credentials" },
                { key: "accessTokenUrl", value: "https://auth.example.com/token" }
            ]
        });
        expect(result.securitySchemes.oauth2Auth?.flows?.password).toBeDefined();
    });

    it("converts digest auth", () => {
        const result = convertAuth({
            type: "digest",
            digest: [
                { key: "username", value: "user" },
                { key: "password", value: "pass" }
            ]
        });
        expect(result.securitySchemes.digestAuth).toEqual({
            type: "http",
            scheme: "digest"
        });
    });
});
