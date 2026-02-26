import { type JWTPayload, jwtVerify } from "jose";
import { UnauthorizedError } from "../errors";

const BEARER_REGEX = /^bearer\s+/i;
const encoder = new TextEncoder();

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET_KEY;
    if (!secret) {
        throw new Error("JWT_SECRET_KEY environment variable is not set");
    }
    return encoder.encode(secret);
}

/**
 * Verify a service JWT token from docs-server.
 * This is used for service-to-service authentication without needing to call Venus.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @throws {UnauthorizedError} if the token is missing, invalid, or not from docs-server
 */
interface VenusJwtPayload extends JWTPayload {
    org_id: string;
}

let cachedCliSecret: Uint8Array | null = null;

function getCliJwtSecret(): Uint8Array {
    if (cachedCliSecret) {
        return cachedCliSecret;
    }

    const secretBase64 = process.env.JWT_SECRET_KEY;
    if (!secretBase64) {
        throw new Error("JWT_SECRET_KEY environment variable is not set");
    }

    cachedCliSecret = Buffer.from(secretBase64, "base64");
    return cachedCliSecret;
}

/**
 * Validate a CLI JWT token from Venus.
 * Venus signs JWTs with HS256 using a base64-decoded secret key.
 * The JWT payload contains org_id which must match the expected organization.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @param expectedOrgId - The organization ID that should match the JWT's org_id claim
 * @returns The validated JWT payload
 * @throws {UnauthorizedError} if the token is missing, invalid, expired, or org_id doesn't match
 */
export async function validateCliJwt(authHeader: string | undefined, expectedOrgId: string): Promise<VenusJwtPayload> {
    if (!authHeader) {
        throw new UnauthorizedError("Authorization header is required");
    }

    const token = authHeader.replace(BEARER_REGEX, "");
    if (!token || token === authHeader) {
        throw new UnauthorizedError("Invalid Authorization header format. Expected: Bearer <token>");
    }

    const secret = getCliJwtSecret();

    try {
        const { payload } = await jwtVerify(token, secret, {
            algorithms: ["HS256"]
        });

        const venusPayload = payload as VenusJwtPayload;

        if (!venusPayload.org_id) {
            throw new UnauthorizedError("JWT is missing org_id claim");
        }

        if (venusPayload.org_id !== expectedOrgId) {
            throw new UnauthorizedError("JWT org_id does not match the requested organization");
        }

        return venusPayload;
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            throw error;
        }

        if (error instanceof Error) {
            if (error.name === "JWTExpired") {
                throw new UnauthorizedError("JWT has expired");
            }
            throw new UnauthorizedError(`Invalid JWT: ${error.message}`);
        }

        throw new UnauthorizedError("Invalid JWT");
    }
}

/**
 * Clear the cached CLI JWT secret. Useful for testing.
 */
export function clearCliJwtSecretCache(): void {
    cachedCliSecret = null;
}

export async function verifyDocsServiceJWT(authHeader: string | undefined): Promise<void> {
    if (!authHeader) {
        throw new UnauthorizedError("Authorization header was not specified");
    }

    const token = authHeader.replace(BEARER_REGEX, "");

    try {
        const { payload } = await jwtVerify(token, getJwtSecret(), {
            issuer: "https://buildwithfern.com",
            audience: "fdr-lambda"
        });

        if (payload.service !== "docs-server") {
            throw new UnauthorizedError("Invalid service token: expected service 'docs-server'");
        }
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            throw error;
        }
        throw new UnauthorizedError(`Invalid JWT token: ${error instanceof Error ? error.message : String(error)}`);
    }
}
