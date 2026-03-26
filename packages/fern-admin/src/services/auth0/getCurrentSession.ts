import { createRemoteJWKSet, jwtVerify } from "jose";
import jwt from "jsonwebtoken";
import { cache } from "react";

import { getAuth0Client } from "@/services/auth0/auth0";

import { type Auth0User, Auth0UserID } from "./types";

export interface Auth0SessionData {
    user: Auth0User;
    accessToken: string;
    permissions?: string[];
    orgId?: string;
}

export const getCurrentSession = cache(async (): Promise<Auth0SessionData | undefined> => {
    const auth0 = await getAuth0Client();
    const session = await auth0.getSession();

    if (session == null) {
        // biome-ignore lint/suspicious/noConsole: server-side logging
        console.debug("[getCurrentSession] No active session found");
        return undefined;
    }

    const decodedAccessToken = jwt.decode(session.tokenSet.accessToken) as Record<string, unknown> | null;
    return {
        user: {
            ...session.user,
            sub: Auth0UserID(session.user.sub)
        },
        accessToken: session.tokenSet.accessToken,
        orgId: typeof decodedAccessToken?.org_id === "string" ? decodedAccessToken.org_id : undefined,
        permissions: Array.isArray(decodedAccessToken?.permissions) ? (decodedAccessToken.permissions as string[]) : []
    };
});

export async function getCurrentSessionOrThrow(): Promise<Auth0SessionData> {
    const session = await getCurrentSession();
    if (session == null) {
        throw new Error("Not authenticated");
    }
    return session;
}

function getAuth0Domain(): string | undefined {
    return process.env.AUTH0_DOMAIN;
}

let _cachedJWKS: ReturnType<typeof createRemoteJWKSet> | undefined;
function getAuth0JWKS(domain: string) {
    if (_cachedJWKS == null) {
        const jwksUrl = new URL(`https://${domain}/.well-known/jwks.json`);
        _cachedJWKS = createRemoteJWKSet(jwksUrl);
    }
    return _cachedJWKS;
}

export interface VerifiedAccessToken {
    userId: Auth0UserID;
    permissions: string[];
    orgId?: string;
    name?: string;
    email?: string;
}

export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    const auth0Domain = getAuth0Domain();
    if (auth0Domain == null) {
        throw new Error("AUTH0_DOMAIN is not configured");
    }

    const JWKS = getAuth0JWKS(auth0Domain);
    const expectedIssuer = `https://${auth0Domain}/`;
    const audience = process.env.NEXT_PUBLIC_VENUS_AUDIENCE;

    const { payload } = await jwtVerify(token, JWKS, {
        algorithms: ["RS256"],
        issuer: expectedIssuer,
        ...(audience != null ? { audience } : {})
    });

    if (payload.sub == null) {
        throw new Error("Verified JWT payload does not include 'sub'");
    }

    const permissions: string[] = Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [];
    const orgId = typeof payload.org_id === "string" ? payload.org_id : undefined;
    const name = typeof payload.name === "string" ? payload.name : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;

    return {
        userId: Auth0UserID(payload.sub),
        permissions,
        orgId,
        name,
        email
    };
}
