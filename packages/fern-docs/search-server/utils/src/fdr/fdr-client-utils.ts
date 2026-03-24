import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { SignJWT } from "jose";

const encoder = new TextEncoder();

function getServiceJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET_KEY;
    if (!secret) {
        throw new Error("JWT_SECRET_KEY is not set");
    }
    return encoder.encode(secret);
}

/**
 * Sign a service JWT for service-to-service authentication with FDR Lambda.
 * This token identifies the caller as docs-server and allows access to FDR Lambda endpoints
 * without needing to call Venus for user verification.
 *
 * @returns A signed JWT token
 */
async function signDocsServiceJWT(): Promise<string> {
    return new SignJWT({ service: "docs-server", scope: "fdr:docs-fields" })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .setIssuer("https://buildwithfern.com")
        .setAudience("fdr-lambda")
        .sign(getServiceJwtSecret());
}

// Cache the token to avoid re-signing on every request
let cachedToken: string | null = null;
let cachedTokenExpiry: number | null = null;

/**
 * Get a cached service JWT token, re-signing only when needed.
 * The token is cached for 29 days (1 day before expiry) to avoid unnecessary re-signing.
 *
 * @returns A signed JWT token
 */
export async function getDocsServiceJWT(): Promise<string> {
    const now = Date.now();
    // Re-sign if token is null or will expire within 1 day
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (cachedToken == null || cachedTokenExpiry == null || now >= cachedTokenExpiry - oneDayMs) {
        cachedToken = await signDocsServiceJWT();
        // Token expires in 30 days, cache expiry is set to 30 days from now
        cachedTokenExpiry = now + 30 * oneDayMs;
    }

    return cachedToken;
}

/**
 * Get the FDR Lambda origin URL from environment variables.
 * The env var is validated at build time in next.config.ts.
 */
export function getFdrLambdaOrigin(): string {
    const value = process.env.NEXT_PUBLIC_FDR_LAMBDA_ORIGIN;
    if (value == null) {
        throw new Error("NEXT_PUBLIC_FDR_LAMBDA_ORIGIN is not defined");
    }
    return withDefaultProtocol(value);
}

/**
 * Check if the application is running in self-hosted mode.
 */
export function isSelfHosted(): boolean {
    return process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1";
}
