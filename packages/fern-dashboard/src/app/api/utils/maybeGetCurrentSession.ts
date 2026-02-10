import jwt from "jsonwebtoken";
import { type NextRequest, NextResponse } from "next/server";

import { decodeAccessToken, getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0UserID } from "@/app/services/auth0/types";

import type { MaybeErrorResponse } from "./MaybeErrorResponse";
import { parseAuthHeader } from "./parseAuthHeader";

export interface ApiSessionData {
    token: string;
    userId: Auth0UserID;
    permissions: string[];
    orgId?: string;
}

export async function maybeGetCurrentSession(req: NextRequest): Promise<MaybeErrorResponse<ApiSessionData>> {
    try {
        if (req.headers.get("authorization") != null) {
            const { token } = parseAuthHeader(req);
            const { userId } = decodeAccessToken(token);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const decodedToken = jwt.decode(token) as any;
            const permissions: string[] = decodedToken?.permissions ?? [];
            const orgId = typeof decodedToken?.org_id === "string" ? (decodedToken.org_id as string) : undefined;
            return { data: { token, userId, permissions, orgId } };
        }

        // I think auth0 uses cookies to get the current session?
        const sessionData = await getCurrentSessionOrThrow();
        return {
            data: {
                token: sessionData.accessToken,
                userId: sessionData.user.sub,
                permissions: sessionData.permissions ?? [],
                orgId: sessionData.orgId
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
