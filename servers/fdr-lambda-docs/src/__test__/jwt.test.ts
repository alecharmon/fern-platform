import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJwtSecretCache, validateCliJwt } from "../utils/jwt";

// Test secret key (base64 encoded)
const TEST_SECRET = "dGVzdC1zZWNyZXQta2V5LWZvci1qd3QtdmFsaWRhdGlvbg==";
const TEST_SECRET_BYTES = Buffer.from(TEST_SECRET, "base64");

async function createTestToken(payload: Record<string, unknown>, options?: { expiresIn?: string }): Promise<string> {
    const jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt();

    if (options?.expiresIn) {
        jwt.setExpirationTime(options.expiresIn);
    } else {
        jwt.setExpirationTime("1h");
    }

    return jwt.sign(TEST_SECRET_BYTES);
}

describe("validateCliJwt", () => {
    beforeEach(() => {
        vi.stubEnv("JWT_SECRET_KEY", TEST_SECRET);
        clearJwtSecretCache();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        clearJwtSecretCache();
    });

    it("should validate a valid JWT with matching org_id", async () => {
        const token = await createTestToken({ org_id: "test-org-123" });
        const authHeader = `Bearer ${token}`;

        const payload = await validateCliJwt(authHeader, "test-org-123");

        expect(payload.org_id).toBe("test-org-123");
    });

    it("should reject missing authorization header", async () => {
        await expect(validateCliJwt(undefined, "test-org")).rejects.toThrow("Authorization header is required");
    });

    it("should reject invalid authorization header format", async () => {
        await expect(validateCliJwt("InvalidFormat", "test-org")).rejects.toThrow(
            "Invalid Authorization header format. Expected: Bearer <token>"
        );
    });

    it("should reject JWT with wrong org_id", async () => {
        const token = await createTestToken({ org_id: "wrong-org" });
        const authHeader = `Bearer ${token}`;

        await expect(validateCliJwt(authHeader, "expected-org")).rejects.toThrow(
            "JWT org_id does not match the requested organization"
        );
    });

    it("should reject JWT without org_id claim", async () => {
        const token = await createTestToken({ some_other_claim: "value" });
        const authHeader = `Bearer ${token}`;

        await expect(validateCliJwt(authHeader, "test-org")).rejects.toThrow("JWT is missing org_id claim");
    });

    it("should reject expired JWT", async () => {
        const token = await createTestToken({ org_id: "test-org" }, { expiresIn: "-1h" });
        const authHeader = `Bearer ${token}`;

        await expect(validateCliJwt(authHeader, "test-org")).rejects.toThrow("JWT has expired");
    });

    it("should reject JWT signed with wrong secret", async () => {
        const wrongSecret = Buffer.from("d3Jvbmctc2VjcmV0LWtleQ==", "base64");
        const token = await new SignJWT({ org_id: "test-org" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(wrongSecret);

        const authHeader = `Bearer ${token}`;

        await expect(validateCliJwt(authHeader, "test-org")).rejects.toThrow("Invalid JWT");
    });

    it("should throw ConfigError when JWT_SECRET_KEY is not set", async () => {
        vi.stubEnv("JWT_SECRET_KEY", "");
        clearJwtSecretCache();

        const token = await createTestToken({ org_id: "test-org" });
        const authHeader = `Bearer ${token}`;

        await expect(validateCliJwt(authHeader, "test-org")).rejects.toThrow(
            "JWT_SECRET_KEY environment variable is not set"
        );
    });

    it("should handle lowercase bearer prefix", async () => {
        const token = await createTestToken({ org_id: "test-org" });
        const authHeader = `bearer ${token}`;

        const payload = await validateCliJwt(authHeader, "test-org");

        expect(payload.org_id).toBe("test-org");
    });

    it("should handle mixed case Bearer prefix", async () => {
        const token = await createTestToken({ org_id: "test-org" });
        const authHeader = `BEARER ${token}`;

        const payload = await validateCliJwt(authHeader, "test-org");

        expect(payload.org_id).toBe("test-org");
    });
});
