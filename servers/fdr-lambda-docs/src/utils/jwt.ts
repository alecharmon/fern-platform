import { type JWTPayload, jwtVerify } from "jose";
import { ConfigError, UnauthorizedError } from "../errors";

const BEARER_REGEX = /^bearer\s+/i;

interface VenusJwtPayload extends JWTPayload {
    org_id: string;
}

let cachedSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
    if (cachedSecret) {
        return cachedSecret;
    }

    const secretBase64 = process.env.JWT_SECRET_KEY;
    if (!secretBase64) {
        throw new ConfigError("JWT_SECRET_KEY environment variable is not set");
    }

    cachedSecret = Buffer.from(secretBase64, "base64");
    return cachedSecret;
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
 * @throws {ConfigError} if JWT_SECRET_KEY is not configured
 */
export async function validateCliJwt(authHeader: string | undefined, expectedOrgId: string): Promise<VenusJwtPayload> {
    if (!authHeader) {
        throw new UnauthorizedError("Authorization header is required");
    }

    const token = authHeader.replace(BEARER_REGEX, "");
    if (!token || token === authHeader) {
        throw new UnauthorizedError("Invalid Authorization header format. Expected: Bearer <token>");
    }

    const secret = getJwtSecret();

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
        if (error instanceof UnauthorizedError || error instanceof ConfigError) {
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
 * Clear the cached JWT secret. Useful for testing.
 */
export function clearJwtSecretCache(): void {
    cachedSecret = null;
}
