import { getAllowedRedirectUrls } from "@fern-api/docs-server/auth/allowed-redirects";
import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { FernNextResponse } from "@fern-api/docs-server/FernNextResponse";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { safeUrl } from "@fern-api/docs-server/safeUrl";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { redirectWithLoginError } from "@/server/redirectWithLoginError";

async function handleJwtCallback(
    req: NextRequest,
    token: string | null,
    returnToParam: string | null
): Promise<NextResponse> {
    const domain = getDocsDomainEdge(req);
    // For self-hosted behind the cache proxy, req.nextUrl.host is the internal
    // Next.js host (e.g. 127.0.0.1:3001). Use x-forwarded-host to get the
    // external-facing host (e.g. localhost:3000) so that redirects and cookies
    // use the correct origin (http:// for localhost, not https://).
    // Decode URI components because the host can contain encoded colons (%3A).
    const rawHost =
        isSelfHosted() && req.headers.get("x-forwarded-host") ? req.headers.get("x-forwarded-host")! : req.nextUrl.host;
    const host = decodeURIComponent(rawHost);
    // For self-hosted, getAuthEdgeConfig reads from FERN_AUTH_* env vars
    const edgeConfig = await getAuthEdgeConfig(domain);

    const returnTo = returnToParam ?? req.nextUrl.searchParams.get(getReturnToQueryParam(edgeConfig));
    const redirectLocation = safeUrl(returnTo) ?? safeUrl(withDefaultProtocol(preferPreview(host, domain)));
    logger.debug("Redirecting", host, domain, redirectLocation);

    if (edgeConfig?.type !== "basic_token_verification" || token == null) {
        logger.error(`[jwt:callback] Invalid config for domain ${domain}`);
        return redirectWithLoginError(req, redirectLocation, "unknown_error", "Couldn't login, please try again");
    }

    const fernUser = await safeVerifyFernJWTConfig(token, edgeConfig);

    if (fernUser == null) {
        return redirectWithLoginError(req, redirectLocation, "unknown_error", "Couldn't login, please try again");
    }

    const res = redirectLocation
        ? FernNextResponse.redirect(req, {
              destination: redirectLocation,
              allowedDestinations: getAllowedRedirectUrls(edgeConfig)
          })
        : NextResponse.next();

    const cookieJar = await cookies();
    cookieJar.set(COOKIE_FERN_TOKEN, token, withSecureCookie(withDefaultProtocol(host)));

    return res;
}

async function getTokenFromCookie(): Promise<string | null> {
    const cookieJar = await cookies();
    return cookieJar.get(COOKIE_FERN_TOKEN)?.value ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return new NextResponse("jwt is not accessible in local preview mode", {
            status: 400
        });
    }

    const token = req.nextUrl.searchParams.get(COOKIE_FERN_TOKEN) ?? (await getTokenFromCookie());
    return handleJwtCallback(req, token, null);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return new NextResponse("jwt is not accessible in local preview mode", {
            status: 400
        });
    }

    const formData = await req.formData();
    const token = formData.get(COOKIE_FERN_TOKEN)?.toString() ?? (await getTokenFromCookie());
    const state = formData.get("state")?.toString() ?? null;
    return handleJwtCallback(req, token, state);
}
