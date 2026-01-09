import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAuth0Client } from "@/app/services/auth0/auth0";

import { type Auth0User, Auth0UserID } from "./types";

export interface Auth0SessionData {
    user: Auth0User;
    accessToken: string;
    permissions?: string[];
}

interface CITestSession {
    user: {
        sub: string;
        name?: string;
        nickname?: string;
        picture?: string;
        email?: string;
        email_verified?: boolean;
    };
    accessToken: string;
    idToken: string;
    refreshToken?: string;
    expiresAt: number;
}

/**
 * Attempts to get a session from the CI test cookie.
 * This is only used when FERN_CI_AUTOMATED_TESTING is enabled.
 */
async function getCITestSession(): Promise<Auth0SessionData | undefined> {
    // Only check for CI session if CI testing is enabled
    if (!process.env.FERN_CI_AUTOMATED_TESTING) {
        return undefined;
    }

    try {
        const cookieStore = await cookies();
        const ciSessionCookie = cookieStore.get("ci_test_session");

        if (!ciSessionCookie?.value) {
            return undefined;
        }

        const sessionData = JSON.parse(Buffer.from(ciSessionCookie.value, "base64").toString()) as CITestSession;

        // Check if session has expired
        if (sessionData.expiresAt < Math.floor(Date.now() / 1000)) {
            console.debug("[getCITestSession] CI test session has expired");
            return undefined;
        }

        console.debug(`[getCITestSession] Found valid CI test session for user: ${sessionData.user.sub}`);

        return {
            user: {
                ...sessionData.user,
                sub: Auth0UserID(sessionData.user.sub)
            },
            accessToken: sessionData.accessToken,
            permissions: sessionData.accessToken
                ? ((jwt.decode(sessionData.accessToken) as any)?.permissions ?? [])
                : []
        };
    } catch (error) {
        console.debug("[getCITestSession] Failed to parse CI test session:", error);
        return undefined;
    }
}

export const getCurrentSession = cache(async (): Promise<Auth0SessionData | undefined> => {
    // First, try to get a CI test session (only works if CI testing is enabled)
    const ciSession = await getCITestSession();
    if (ciSession) {
        return ciSession;
    }

    // Fall back to standard Auth0 session
    const auth0 = await getAuth0Client();
    const session = await auth0.getSession();

    if (session == null) {
        console.debug("[getCurrentSession] No active session found");
        return undefined;
    }

    console.debug("[getCurrentSession] Decoded accessToken:", jwt.decode(session.tokenSet.accessToken));
    console.debug(
        "[getCurrentSession] permissions from accessToken:",
        (jwt.decode(session.tokenSet.accessToken) as any)?.permissions
    );
    console.debug(`[getCurrentSession] Active session found for user: ${session.user.sub}`);
    return {
        user: {
            ...session.user,
            sub: Auth0UserID(session.user.sub)
        },
        accessToken: session.tokenSet.accessToken,
        permissions: session.tokenSet.accessToken
            ? ((jwt.decode(session.tokenSet.accessToken) as any)?.permissions ?? [])
            : []
    };
});

export async function getCurrentSessionOrThrow(): Promise<Auth0SessionData> {
    const session = await getCurrentSession();
    if (session == null) {
        throw new Error("Not authenticated");
    }
    return session;
}

export function decodeAccessToken(token: string) {
    const jwtPayload = jwt.decode(token);
    console.error("Decoded JWT payload:", jwtPayload);
    if (jwtPayload == null) {
        throw new Error("accessToken JWT payload is not defined");
    }
    if (typeof jwtPayload !== "object") {
        throw new Error("accessToken JWT payload is not an object");
    }
    if (jwtPayload?.sub == null) {
        throw new Error("accessToken JWT payload does not include 'sub'");
    }

    return {
        userId: Auth0UserID(jwtPayload.sub)
    };
}
