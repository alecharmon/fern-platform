import { isSuperUser } from "@fern-api/user-permissions";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSessionOrThrow, verifyAccessToken } from "@/services/auth0/getCurrentSession";
import type { Auth0UserID } from "@/services/auth0/types";

export interface InternalApiSessionData {
    userId: Auth0UserID;
    email: string;
    permissions: string[];
}

interface InternalAuthSuccess {
    data: InternalApiSessionData;
    errorResponse?: never;
}

interface InternalAuthError {
    data?: never;
    errorResponse: NextResponse;
}

type InternalAuthResult = InternalAuthSuccess | InternalAuthError;

/**
 * Verifies that the request is from an authenticated super-user.
 * Supports both Authorization header (Bearer token) and cookie-based sessions.
 */
export async function verifyInternalAuth(req: NextRequest): Promise<InternalAuthResult> {
    try {
        let userId: Auth0UserID;
        let email: string | undefined;
        let permissions: string[] = [];

        const authHeader = req.headers.get("authorization");
        if (authHeader != null) {
            const token = authHeader.split(" ")[1];
            if (token == null) {
                return {
                    errorResponse: NextResponse.json({ error: "Invalid authorization header" }, { status: 401 })
                };
            }
            const verified = await verifyAccessToken(token);
            userId = verified.userId;
            email = verified.email;
            permissions = verified.permissions;
        } else {
            const session = await getCurrentSessionOrThrow();
            userId = session.user.sub;
            email = session.user.email;
            permissions = session.permissions ?? [];
        }

        if (!isSuperUser(permissions)) {
            return {
                errorResponse: NextResponse.json(
                    { error: "Forbidden: requires super-user permissions" },
                    { status: 403 }
                )
            };
        }

        return { data: { userId, email: email ?? "", permissions } };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: server-side logging
        console.error("[verifyInternalAuth] Auth check failed", error);
        return {
            errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        };
    }
}
