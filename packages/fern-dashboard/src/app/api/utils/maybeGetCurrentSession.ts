import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSessionOrThrow, verifyAccessToken } from "@/app/services/auth0/getCurrentSession";
import type { Auth0UserID } from "@/app/services/auth0/types";

import type { MaybeErrorResponse } from "./MaybeErrorResponse";
import { parseAuthHeader } from "./parseAuthHeader";

export interface ApiSessionData {
    token: string;
    userId: Auth0UserID;
    permissions: string[];
    orgId?: string;
    /** The authenticated user's display name (from Auth0 profile). */
    name?: string;
    /** The authenticated user's email address (from Auth0 profile). */
    email?: string;
}

export async function maybeGetCurrentSession(req: NextRequest): Promise<MaybeErrorResponse<ApiSessionData>> {
    try {
        if (req.headers.get("authorization") != null) {
            const { token } = parseAuthHeader(req);
            const verified = await verifyAccessToken(token);
            return {
                data: {
                    token,
                    userId: verified.userId,
                    permissions: verified.permissions,
                    orgId: verified.orgId,
                    name: verified.name,
                    email: verified.email
                }
            };
        }

        // I think auth0 uses cookies to get the current session?
        const sessionData = await getCurrentSessionOrThrow();
        return {
            data: {
                token: sessionData.accessToken,
                userId: sessionData.user.sub,
                permissions: sessionData.permissions ?? [],
                orgId: sessionData.orgId,
                name: sessionData.user.name,
                email: sessionData.user.email
            }
        };
    } catch (e) {
        console.error("Failed to get session data", e, {
            requestHeaders: Object.fromEntries(req.headers.entries()),
            requestUrl: req.url
        });
        return {
            errorResponse: NextResponse.json(
                {
                    message: "Unable to get current session"
                },
                { status: 401 }
            )
        };
    }
}
