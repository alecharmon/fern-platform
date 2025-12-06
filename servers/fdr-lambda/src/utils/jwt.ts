import { jwtVerify } from "jose";
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
