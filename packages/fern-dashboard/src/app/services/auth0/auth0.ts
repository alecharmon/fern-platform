import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

import { getAppUrlServerSide } from "../../../utils/getAppUrlServerSide";
/**
 * Creates a cached Auth0Client instance for the current request.
 * Uses React.cache() to deduplicate client creation within a single request tree.
 */
export const getAuth0Client = async () => {
    const appBaseUrl = await getAppUrlServerSide();
    return new Auth0Client({
        async beforeSessionSaved(session, idToken) {
            return {
                ...session,
                idToken
            };
        },
        async onCallback(error, context, _session) {
            if (error) {
                console.error("[Auth0] Callback error:", error.code, error.message);
                // Redirect to /auth/login with error info so middleware can track retries
                const loginUrl = new URL("/auth/login", appBaseUrl);
                loginUrl.searchParams.set("callback_error", error.code ?? "unknown");
                return NextResponse.redirect(loginUrl);
            }
            return NextResponse.redirect(new URL(context.returnTo ?? "/", appBaseUrl));
        },
        authorizationParameters: {
            audience: process.env.NEXT_PUBLIC_VENUS_AUDIENCE
        },
        appBaseUrl,
        httpTimeout: 60_000
    });
};

export function getAuth0ClientId() {
    if (process.env.AUTH0_CLIENT_ID == null) {
        throw new Error("AUTH0_CLIENT_ID is not defined in the current environment");
    }
    return process.env.AUTH0_CLIENT_ID;
}
