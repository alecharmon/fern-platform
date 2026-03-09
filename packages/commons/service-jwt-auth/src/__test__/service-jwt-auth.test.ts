import { jwtVerify, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signServiceJwt } from "../sign.js";
import { verifyServiceJwt } from "../verify.js";

const TEST_SECRET = "test-secret-key-at-least-32-chars-long";
const TEST_ISSUER = "https://buildwithfern.com";
const TEST_AUDIENCE = "activity-log-lambda";
const TEST_SERVICE = "docs-server";

const baseConfig = {
    secret: TEST_SECRET,
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    service: TEST_SERVICE
};

describe("signServiceJwt", () => {
    it("produces a valid JWT string", async () => {
        const token = await signServiceJwt(baseConfig);
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);
    });

    it("embeds the service claim in the payload", async () => {
        const token = await signServiceJwt(baseConfig);
        const encoder = new TextEncoder();
        const { payload } = await jwtVerify(token, encoder.encode(TEST_SECRET), {
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(payload.service).toBe(TEST_SERVICE);
    });

    it("sets issuer and audience correctly", async () => {
        const token = await signServiceJwt(baseConfig);
        const encoder = new TextEncoder();
        const { payload } = await jwtVerify(token, encoder.encode(TEST_SECRET), {
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(payload.iss).toBe(TEST_ISSUER);
        expect(payload.aud).toBe(TEST_AUDIENCE);
    });

    it("respects custom expiresIn", async () => {
        const token = await signServiceJwt({ ...baseConfig, expiresIn: "5m" });
        const encoder = new TextEncoder();
        const { payload } = await jwtVerify(token, encoder.encode(TEST_SECRET));
        expect(payload.exp).toBeDefined();
        // exp should be within ~5 minutes from now
        const fiveMinFromNow = Math.floor(Date.now() / 1000) + 300;
        expect(payload.exp!).toBeGreaterThan(fiveMinFromNow - 5);
        expect(payload.exp!).toBeLessThanOrEqual(fiveMinFromNow + 5);
    });

    it("defaults to 1h expiry when expiresIn is not provided", async () => {
        const token = await signServiceJwt(baseConfig);
        const encoder = new TextEncoder();
        const { payload } = await jwtVerify(token, encoder.encode(TEST_SECRET));
        expect(payload.exp).toBeDefined();
        const oneHourFromNow = Math.floor(Date.now() / 1000) + 3600;
        expect(payload.exp!).toBeGreaterThan(oneHourFromNow - 5);
        expect(payload.exp!).toBeLessThanOrEqual(oneHourFromNow + 5);
    });
});

describe("verifyServiceJwt", () => {
    it("returns ok with payload for a valid token", async () => {
        const token = await signServiceJwt(baseConfig);
        const result = await verifyServiceJwt(token, {
            secret: TEST_SECRET,
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.service).toBe(TEST_SERVICE);
            expect(result.value.iss).toBe(TEST_ISSUER);
            expect(result.value.aud).toBe(TEST_AUDIENCE);
        }
    });

    it("returns INVALID_TOKEN for a malformed token", async () => {
        const result = await verifyServiceJwt("not-a-jwt", {
            secret: TEST_SECRET,
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INVALID_TOKEN");
            expect(result.error.source).toBe("service-jwt-auth");
        }
    });

    it("returns INVALID_TOKEN for wrong secret", async () => {
        const token = await signServiceJwt(baseConfig);
        const result = await verifyServiceJwt(token, {
            secret: "wrong-secret-key-at-least-32-chars-long",
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INVALID_TOKEN");
        }
    });

    it("returns INVALID_TOKEN for wrong audience", async () => {
        const token = await signServiceJwt(baseConfig);
        const result = await verifyServiceJwt(token, {
            secret: TEST_SECRET,
            issuer: TEST_ISSUER,
            audience: "wrong-audience"
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INVALID_TOKEN");
        }
    });

    it("returns INVALID_TOKEN for wrong issuer", async () => {
        const token = await signServiceJwt(baseConfig);
        const result = await verifyServiceJwt(token, {
            secret: TEST_SECRET,
            issuer: "https://wrong-issuer.com",
            audience: TEST_AUDIENCE
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INVALID_TOKEN");
        }
    });

    it("returns TOKEN_EXPIRED for an expired token", async () => {
        // Create an already-expired token manually
        const encoder = new TextEncoder();
        const token = await new SignJWT({ service: TEST_SERVICE })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(TEST_ISSUER)
            .setAudience(TEST_AUDIENCE)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
            .sign(encoder.encode(TEST_SECRET));

        const result = await verifyServiceJwt(token, {
            secret: TEST_SECRET,
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("TOKEN_EXPIRED");
        }
    });

    it("returns INVALID_SERVICE when service claim is missing", async () => {
        // Token without service claim
        const encoder = new TextEncoder();
        const token = await new SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(TEST_ISSUER)
            .setAudience(TEST_AUDIENCE)
            .setExpirationTime("1h")
            .sign(encoder.encode(TEST_SECRET));

        const result = await verifyServiceJwt(token, {
            secret: TEST_SECRET,
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INVALID_SERVICE");
        }
    });
});

describe("env var default secret", () => {
    const originalEnv = process.env.JWT_SECRET_KEY;

    beforeEach(() => {
        process.env.JWT_SECRET_KEY = TEST_SECRET;
    });

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.JWT_SECRET_KEY = originalEnv;
        } else {
            delete process.env.JWT_SECRET_KEY;
        }
    });

    it("signServiceJwt uses JWT_SECRET_KEY when secret is omitted", async () => {
        const token = await signServiceJwt({
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE,
            service: TEST_SERVICE
        });
        const encoder = new TextEncoder();
        const { payload } = await jwtVerify(token, encoder.encode(TEST_SECRET), {
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(payload.service).toBe(TEST_SERVICE);
    });

    it("verifyServiceJwt uses JWT_SECRET_KEY when secret is omitted", async () => {
        const token = await signServiceJwt(baseConfig);
        const result = await verifyServiceJwt(token, {
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isOk()).toBe(true);
    });

    it("signServiceJwt returns NOT_CONFIGURED when secret is omitted and env var is unset", async () => {
        delete process.env.JWT_SECRET_KEY;
        const result = await signServiceJwt({
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE,
            service: TEST_SERVICE
        }).catch((e) => e);
        expect(result).toMatchObject({
            source: "service-jwt-auth",
            code: "NOT_CONFIGURED"
        });
    });

    it("verifyServiceJwt returns NOT_CONFIGURED when secret is omitted and env var is unset", async () => {
        delete process.env.JWT_SECRET_KEY;
        const token = await signServiceJwt(baseConfig);
        const result = await verifyServiceJwt(token, {
            issuer: TEST_ISSUER,
            audience: TEST_AUDIENCE
        });
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("NOT_CONFIGURED");
        }
    });
});
