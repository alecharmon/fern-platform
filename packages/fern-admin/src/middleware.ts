import { type NextRequest, NextResponse } from "next/server";

import { getAuth0Client } from "@/services/auth0/auth0";

function normalizeRedirectOnLogin(redirectOnLogin: string | null): string | undefined {
    if (typeof redirectOnLogin === "string" && redirectOnLogin.startsWith("/") && !redirectOnLogin.startsWith("//")) {
        return redirectOnLogin;
    }
    return undefined;
}

function isSecureRequest(req: NextRequest): boolean {
    return req.nextUrl.protocol === "https:";
}

export async function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/auth/")) {
        return await applyAuth0Middleware(req);
    }

    const response = NextResponse.next();
    response.headers.set("x-current-path", req.nextUrl.pathname + req.nextUrl.search);
    return response;
}

async function applyAuth0Middleware(req: NextRequest): Promise<NextResponse> {
    const auth0 = await getAuth0Client();
    const authResponse = await auth0.middleware(req);

    const reqCookieNames = req.cookies.getAll().map((cookie) => cookie.name);
    reqCookieNames.forEach((cookie) => {
        if (cookie.startsWith("__txn")) {
            authResponse.cookies.delete(cookie);
        }
    });

    if (req.nextUrl.pathname === "/auth/callback") {
        authResponse.cookies.delete("silent_auth_retries");
        authResponse.cookies.delete("auth_retry_count");
    }

    const redirectLocation = normalizeRedirectOnLogin(req.nextUrl.searchParams.get("redirect_on_login"));
    if (req.nextUrl.pathname === "/auth/login" && redirectLocation) {
        authResponse.cookies.set("redirect_on_login", redirectLocation, {
            httpOnly: true,
            secure: isSecureRequest(req),
            sameSite: "lax",
            maxAge: 600
        });
    }

    return authResponse;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"]
};
