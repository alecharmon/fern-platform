/**
 * Shared JWT minting utilities.
 *
 * Used by both warmup.ts (to mint short-lived JWTs for cache warming)
 * and test-login.ts (to mint test JWTs for the mock login flow).
 */

import { getJwtIssuer, getJwtSecret } from "./auth";

function base64url(input: string): string {
    return btoa(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signHS256(secret: string, data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
    return btoa(String.fromCharCode(...signatureBytes))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

export interface MintJWTOptions {
    fernPayload?: Record<string, unknown>;
    expiresInSeconds?: number;
    secret?: string;
    issuer?: string;
}

export async function mintJWT(options: MintJWTOptions = {}): Promise<string | null> {
    const secret = options.secret || getJwtSecret();
    if (!secret) {
        return null;
    }

    const issuer = options.issuer || getJwtIssuer();
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        fern: options.fernPayload ?? {},
        iat: now,
        exp: now + (options.expiresInSeconds ?? 60 * 60),
        iss: issuer
    };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signatureB64 = await signHS256(secret, headerB64 + "." + payloadB64);

    return headerB64 + "." + payloadB64 + "." + signatureB64;
}
