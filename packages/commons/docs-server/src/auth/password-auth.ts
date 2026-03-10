import type { PasswordAuth } from "@fern-api/docs-auth";
import { timingSafeEqual } from "crypto";

import { signFernJWT, verifyFernJWT } from "./FernJWT";

const DEFAULT_PASSWORD_ROLE = "authenticated";

interface SignPasswordAuthOptions {
    secret: string;
    roles?: string[];
}

interface PasswordMatchResult {
    matched: boolean;
    roles: string[];
}

/**
 * Match a submitted password against the auth config.
 * Checks the `passwords` array first (if present), then falls back to singular `password`.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function matchPassword(authConfig: PasswordAuth, submittedPassword: string): PasswordMatchResult {
    const submittedBuf = Buffer.from(submittedPassword, "utf-8");

    // Check against `passwords` array first (if present)
    if (authConfig.passwords != null) {
        for (const entry of authConfig.passwords) {
            const entryBuf = Buffer.from(entry.password, "utf-8");
            const lengthsMatch = submittedBuf.length === entryBuf.length;
            if (lengthsMatch && timingSafeEqual(submittedBuf, entryBuf)) {
                return { matched: true, roles: entry.roles };
            }
        }
    }

    // Check against singular `password` (if present)
    if (authConfig.password != null) {
        const configBuf = Buffer.from(authConfig.password, "utf-8");
        const lengthsMatch = submittedBuf.length === configBuf.length;
        if (lengthsMatch && timingSafeEqual(submittedBuf, configBuf)) {
            return { matched: true, roles: [DEFAULT_PASSWORD_ROLE] };
        }
    }

    return { matched: false, roles: [] };
}

export async function signPasswordAuthJWT({ secret, roles }: SignPasswordAuthOptions): Promise<string> {
    return signFernJWT({ roles: roles ?? [DEFAULT_PASSWORD_ROLE] }, { secret });
}

export async function verifyPasswordAuthJWT(
    token: string,
    secret: string
): Promise<{ valid: true; roles: string[] } | { valid: false }> {
    try {
        const fernUser = await verifyFernJWT(token, secret);
        return {
            valid: true,
            roles: fernUser.roles ?? []
        };
    } catch {
        return { valid: false };
    }
}

export async function safeVerifyPasswordAuth(
    token: string | undefined,
    secret: string
): Promise<{ valid: true; roles: string[] } | { valid: false }> {
    if (!token) {
        return { valid: false };
    }
    return verifyPasswordAuthJWT(token, secret);
}
