import * as Sentry from "@sentry/nextjs";
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
    orgName?: string;
    /** The authenticated user's display name (from Auth0 profile). */
    name?: string;
    /** The authenticated user's email address (from Auth0 profile). */
    email?: string;
}

export async function maybeGetCurrentSession(req: NextRequest): Promise<MaybeErrorResponse<ApiSessionData>> {
    try {
        let data: ApiSessionData;

        if (req.headers.get("authorization") != null) {
            const { token } = parseAuthHeader(req);
            const verified = await verifyAccessToken(token);
            data = {
                token,
                userId: verified.userId,
                permissions: verified.permissions,
                orgId: verified.orgId,
                orgName: verified.orgName,
                name: verified.name,
                email: verified.email
            };
        } else {
            // Auth0 uses cookies to get the current session
            const sessionData = await getCurrentSessionOrThrow();
            data = {
                token: sessionData.accessToken,
                userId: sessionData.user.sub,
                permissions: sessionData.permissions ?? [],
                orgId: sessionData.orgId,
                orgName: sessionData.orgName,
                name: sessionData.user.name,
                email: sessionData.user.email
            };
        }

        Sentry.setUser({ id: data.userId, email: data.email });
        Sentry.setTag("userEmail", data.email);
        Sentry.setTag("orgName", data.orgName);

        return { data };
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
