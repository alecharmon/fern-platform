import { getEmailLoginConfig } from "@fern-docs/edge-config";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";

import { buildErrorPageSearchParams } from "./app/error/searchParams";
import { getAuth0Client } from "./app/services/auth0/auth0";
import { checkRoutePermissions } from "./route-permissions";

function normalizeRedirectOnLogin(redirectOnLogin: string | null): string | undefined {
    if (typeof redirectOnLogin === "string" && redirectOnLogin.startsWith("/") && !redirectOnLogin.startsWith("//")) {
        return redirectOnLogin;
    }

    return undefined;
}

function isSecureRequest(req: NextRequest): boolean {
    return req.nextUrl.protocol === "https:";
}

export async function proxy(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/auth/postman/")) {
        return NextResponse.next();
    }

    if (req.nextUrl.pathname.startsWith("/ingest")) {
        return applyPosthogMiddleware(req);
    }

    if (req.nextUrl.pathname.startsWith("/auth/")) {
        const callbackError = req.nextUrl.searchParams.get("callback_error");
        if (callbackError != null && req.nextUrl.pathname === "/auth/login") {
            const retryCount = parseInt(req.cookies.get("auth_retry_count")?.value ?? "0", 10);

            if (retryCount >= 3) {
                Sentry.captureMessage("Auth callback error loop detected", {
                    level: "error",
                    extra: { callbackError, retryCount, url: req.nextUrl.toString() }
                });
                const errorUrl = new URL("/error", req.nextUrl.origin);
                errorUrl.searchParams.set("error", callbackError);
                errorUrl.searchParams.set(
                    "message",
                    "Login failed after multiple attempts. Please clear your browser cookies and try again."
                );
                const response = NextResponse.redirect(errorUrl);
                response.cookies.delete("auth_retry_count");
                return response;
            }

            const loginUrl = new URL("/auth/login", req.nextUrl.origin);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.set("auth_retry_count", String(retryCount + 1), {
                httpOnly: true,
                secure: isSecureRequest(req),
                sameSite: "lax",
                maxAge: 300
            });
            return response;
        }

        const error = req.nextUrl.searchParams.get("error");
        if (error != null) {
            const silentAuthErrors = ["login_required", "consent_required", "interaction_required"];
            if (silentAuthErrors.includes(error)) {
                const silentRetryCount = parseInt(req.cookies.get("silent_auth_retries")?.value ?? "0", 10);

                if (silentRetryCount >= 2) {
                    Sentry.captureMessage("Silent auth retry loop detected", {
                        level: "error",
                        extra: { error, silentRetryCount, url: req.nextUrl.toString() }
                    });
                    const errorUrl = new URL("/error", req.nextUrl.origin);
                    errorUrl.searchParams.set("error", "auth_loop_detected");
                    errorUrl.searchParams.set(
                        "message",
                        "Unable to complete authentication. Please try logging in again or clear your browser cookies."
                    );
                    const response = NextResponse.redirect(errorUrl);
                    response.cookies.delete("silent_auth_retries");
                    response.cookies.delete("redirect_on_login");
                    return response;
                }

                const loginUrl = new URL("/auth/login", req.nextUrl.origin);
                for (const param of [
                    "audience",
                    "connection",
                    "invitation",
                    "login_hint",
                    "organization",
                    "redirect_on_login",
                    "scope",
                    "screen_hint"
                ]) {
                    const value = req.nextUrl.searchParams.get(param);
                    if (param === "redirect_on_login") {
                        const normalized = normalizeRedirectOnLogin(value);
                        if (normalized != null) {
                            loginUrl.searchParams.set(param, normalized);
                        }
                    } else if (value != null) {
                        loginUrl.searchParams.set(param, value);
                    }
                }

                if (!loginUrl.searchParams.has("redirect_on_login")) {
                    const redirectOnLogin = normalizeRedirectOnLogin(
                        req.cookies.get("redirect_on_login")?.value ?? null
                    );
                    if (redirectOnLogin) {
                        loginUrl.searchParams.set("redirect_on_login", redirectOnLogin);
                    }
                }

                const organizationId = loginUrl.searchParams.get("organization");
                if (organizationId != null && !loginUrl.searchParams.has("connection")) {
                    const connection = await getConnectionForOrgId(organizationId);
                    if (connection != null) {
                        loginUrl.searchParams.set("connection", connection);
                    }
                }

                const response = NextResponse.redirect(loginUrl);
                response.cookies.set("silent_auth_retries", String(silentRetryCount + 1), {
                    httpOnly: true,
                    secure: isSecureRequest(req),
                    sameSite: "lax",
                    maxAge: 300
                });
                return response;
            }

            return NextResponse.redirect(
                new URL("/error?" + buildErrorPageSearchParams(req.nextUrl.searchParams).toString(), req.nextUrl.origin)
            );
        }

        return await applyAuth0Middleware(req);
    }

    if (!req.nextUrl.pathname.startsWith("/login/")) {
        const permissionCheck = await checkRoutePermissions(req);
        if (permissionCheck) {
            return permissionCheck;
        }
    }

    const pendingRedirect = normalizeRedirectOnLogin(req.cookies.get("redirect_on_login")?.value ?? null);
    if (pendingRedirect) {
        const currentFullPath = req.nextUrl.pathname + req.nextUrl.search;
        if (currentFullPath === pendingRedirect) {
            const response = NextResponse.next();
            response.cookies.delete("redirect_on_login");
            response.headers.set("x-current-path", currentFullPath);
            return response;
        }

        const response = NextResponse.redirect(new URL(pendingRedirect, req.nextUrl.origin));
        response.cookies.delete("redirect_on_login");
        return response;
    }

    const response = NextResponse.next();
    response.headers.set("x-current-path", req.nextUrl.pathname + req.nextUrl.search);
    return response;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"]
};

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

    const pendingRedirect = normalizeRedirectOnLogin(req.cookies.get("redirect_on_login")?.value ?? null);
    if (pendingRedirect && req.nextUrl.pathname.includes(pendingRedirect)) {
        authResponse.cookies.delete("redirect_on_login");
    }

    return authResponse;
}

async function getConnectionForOrgId(orgId: string): Promise<string | undefined> {
    try {
        const { connectionToOrg } = await getEmailLoginConfig();
        for (const [connection, entry] of Object.entries(connectionToOrg)) {
            if (entry.org_id === orgId) {
                return connection;
            }
        }
    } catch (error) {
        console.error("[proxy] Failed to look up connection for org", { orgId, error });
    }

    return undefined;
}

const INGEST_PATH_REGEX = /^\/ingest/;

function applyPosthogMiddleware(req: NextRequest): NextResponse {
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
