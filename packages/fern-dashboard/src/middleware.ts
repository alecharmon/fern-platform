import { type NextRequest, NextResponse } from "next/server";

import { buildErrorPageSearchParams } from "./app/error/searchParams";
import { getAuth0Client } from "./app/services/auth0/auth0";

export async function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/ingest")) {
        return applyPosthogMiddleware(req);
    }

    if (req.nextUrl.pathname.startsWith("/auth/")) {
        // doing error redirection here, even though the auth0 docs say to do it in
        // the onCallback handler in the Auth0Client contructor. this is because in
        // the onCallback handler, the error is always just "An error occured during
        // the authorization flow" vs. here we get actually useful errors
        const error = req.nextUrl.searchParams.get("error");
        if (error != null) {
            return NextResponse.redirect(
                new URL("/error?" + buildErrorPageSearchParams(req.nextUrl.searchParams).toString(), req.nextUrl.origin)
            );
        }
        return await applyAuth0Middleware(req);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"]
};

async function applyAuth0Middleware(req: NextRequest): Promise<NextResponse> {
    const auth0 = await getAuth0Client();
    const authResponse = await auth0.middleware(req);

    // copied from https://github.com/auth0/nextjs-auth0/issues/1983
    if (req.nextUrl.pathname === "/auth/login") {
        // This is a workaround for this issue: https://github.com/auth0/nextjs-auth0/issues/1917
        // The auth0 middleware sets some transaction cookies that are not deleted after the login flow completes.
        // This causes stale cookies to be used in subsequent requests and eventually causes the request header to be rejected because it is too large.
        const reqCookieNames = req.cookies.getAll().map((cookie) => cookie.name);
        reqCookieNames.forEach((cookie) => {
            if (cookie.startsWith("__txn")) {
                authResponse.cookies.delete(cookie);
            }
        });
    }

    // Handle redirects after successful authentication
    const redirectLocation = req.nextUrl.searchParams.get("redirect_on_login");
    if (req.nextUrl.pathname === "/auth/login" && redirectLocation) {
        // If the user is logging in and they are attempting to access a specific page, we need to store the page
        // in a cookie so we can redirect them there after log in
        authResponse.cookies.set("redirect_on_login", redirectLocation, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 600 // 10 minutes
        });
    }

    // Let Auth0 handle the callback first, then check for pending redirects on the next request
    // Don't intercept /auth/callback as it prevents Auth0 from establishing the session properly

    // Clear the redirect_on_login cookie when user accesses matching page
    // This ensures the cookie doesn't persist after the invitation flow is complete
    const pendingRedirect = req.cookies.get("redirect_on_login")?.value;
    if (pendingRedirect && req.nextUrl.pathname.includes(pendingRedirect)) {
        authResponse.cookies.delete("redirect_on_login");
    }

    return authResponse;
}

const INGEST_PATH_REGEX = /^\/ingest/;

function applyPosthogMiddleware(req: NextRequest): NextResponse {
    // https://posthog.com/docs/advanced/proxy/nextjs-middleware
    const url = req.nextUrl.clone();
    const headers = new Headers(req.headers);

    const hostname = url.pathname.startsWith("/ingest/static/") ? "us-assets.i.posthog.com" : "us.i.posthog.com";

    headers.set("host", hostname);

    url.protocol = "https";
    url.hostname = hostname;
    url.port = "443";
    url.pathname = url.pathname.replace(INGEST_PATH_REGEX, "");

    return NextResponse.rewrite(url, { headers });
}
