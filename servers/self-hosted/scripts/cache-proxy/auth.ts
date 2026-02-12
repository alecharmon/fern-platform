/**
 * JWT verification and auth extraction for cache key generation.
 *
 * Replicates the auth logic from middleware.ts / getAuthState.ts
 * so the cache proxy can include auth state in cache keys.
 */

import crypto from "crypto";
import type http from "http";
import {
    EVERYONE_ROLE,
    FERN_AUTH_ISSUER,
    FERN_AUTH_SECRET,
    FERN_AUTH_TYPE,
    JWT_SECRET_KEY,
    OAUTH_JWT_SECRET
} from "./config";
import { debug } from "./logger";

export interface AuthInfo {
    isLoggedIn: boolean;
    roles: string[];
}

/**
 * Get the appropriate JWT secret based on the configured auth type.
 * Mirrors the logic in middleware.ts / getAuthState.ts.
 */
export function getJwtSecret(): string {
    switch (FERN_AUTH_TYPE) {
        case "basic_token_verification":
            return FERN_AUTH_SECRET;
        case "password":
            return JWT_SECRET_KEY;
        case "oauth2":
            return OAUTH_JWT_SECRET || FERN_AUTH_SECRET;
        default:
            return FERN_AUTH_SECRET || JWT_SECRET_KEY;
    }
}

/**
 * Get the expected JWT issuer based on the configured auth type.
 */
export function getJwtIssuer(): string {
    return FERN_AUTH_ISSUER || "https://buildwithfern.com";
}

/**
 * Decode a base64url-encoded string to a Buffer.
 */
export function base64urlDecode(str: string): Buffer {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
        base64 += "=";
    }
    return Buffer.from(base64, "base64");
}

/**
 * Verify a Fern JWT token and extract user info.
 * Uses HMAC-SHA256 verification matching the jose library's behavior.
 * Returns the decoded payload if valid, null if invalid.
 */
export function verifyFernJWT(token: string | null | undefined): Record<string, unknown> | null {
    if (!token || typeof token !== "string") {
        return null;
    }

    const secret = getJwtSecret();
    if (!secret) {
        debug("No JWT secret configured, cannot verify token");
        return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
        debug("Invalid JWT format: expected 3 parts");
        return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    try {
        const expectedSignature = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
        const actualSignature = base64urlDecode(signatureB64);

        if (
            expectedSignature.length !== actualSignature.length ||
            !crypto.timingSafeEqual(expectedSignature, actualSignature)
        ) {
            debug("JWT signature verification failed");
            return null;
        }

        const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            debug("JWT token expired");
            return null;
        }

        const expectedIssuer = getJwtIssuer();
        if (payload.iss && payload.iss !== expectedIssuer) {
            debug(`JWT issuer mismatch: expected ${expectedIssuer}, got ${payload.iss}`);
            return null;
        }

        return payload;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        debug(`JWT verification error: ${message}`);
        return null;
    }
}

/**
 * Extract the fern_token from request headers or cookies.
 * Checks the FERN_TOKEN header first, then falls back to the fern_token cookie,
 * matching the behavior of middleware.ts.
 */
export function extractFernToken(req: http.IncomingMessage): string | null {
    // Check FERN_TOKEN header first (matches middleware.ts behavior)
    const headerToken = req.headers["fern_token"] as string | undefined;
    if (headerToken) {
        return headerToken;
    }

    // Fall back to fern_token cookie
    const cookieHeader = req.headers["cookie"];
    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split("=");
        if (name.trim() === "fern_token") {
            return valueParts.join("=");
        }
    }

    return null;
}

/**
 * Extract auth info (isLoggedIn, roles) from the request.
 * Replicates the auth logic from middleware.ts for cache key generation.
 */
export function getAuthInfoFromRequest(req: http.IncomingMessage): AuthInfo {
    if (!FERN_AUTH_TYPE) {
        return { isLoggedIn: false, roles: [EVERYONE_ROLE] };
    }

    const token = extractFernToken(req);
    if (!token) {
        return { isLoggedIn: false, roles: [EVERYONE_ROLE] };
    }

    const payload = verifyFernJWT(token);
    if (!payload) {
        return { isLoggedIn: false, roles: [EVERYONE_ROLE] };
    }

    const fernData = (payload.fern as Record<string, unknown>) || {};
    const userRoles = Array.isArray(fernData.roles) ? (fernData.roles as string[]) : [];
    const roles = [EVERYONE_ROLE, ...userRoles.filter((r) => r !== EVERYONE_ROLE)];

    return { isLoggedIn: true, roles };
}
