import jwt from "jsonwebtoken";

import { getAuth0Client } from "@/app/services/auth0/auth0";

import { type Auth0User, Auth0UserID } from "./types";

export interface Auth0SessionData {
    user: Auth0User;
    accessToken: string;
}

export async function getCurrentSession(): Promise<Auth0SessionData | undefined> {
    const auth0 = await getAuth0Client();
    const session = await auth0.getSession();
    if (session == null) {
        console.log("[getCurrentSession] No active session found");
        return undefined;
    }
    console.log(`[getCurrentSession] Active session found for user: ${session.user.sub}`);
    return {
        user: {
            ...session.user,
            sub: Auth0UserID(session.user.sub)
        },
        accessToken: session.tokenSet.accessToken
    };
}

export async function getCurrentSessionOrThrow(): Promise<Auth0SessionData> {
    const session = await getCurrentSession();
    if (session == null) {
        throw new Error("Not authenticated");
    }
    return session;
}

export function decodeAccessToken(token: string) {
    const jwtPayload = jwt.decode(token);
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
