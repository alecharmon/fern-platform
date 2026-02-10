import { getAllowedRedirectUrls } from "@fern-api/docs-server/auth/allowed-redirects";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import { normalizeDomainForCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { revokeSessionForToken } from "@fern-api/docs-server/auth/workos-session";
import { FernNextResponse } from "@fern-api/docs-server/FernNextResponse";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { safeUrl } from "@fern-api/docs-server/safeUrl";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_ACCESS_TOKEN, COOKIE_FERN_TOKEN, COOKIE_REFRESH_TOKEN } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return new NextResponse("auth logout is not accessible in local preview mode", {
            status: 400
        });
    }

    const rawHost = req.headers.get("x-forwarded-host") ?? req.nextUrl.host;
    const host = decodeURIComponent(rawHost);
    const domain = getDocsDomainEdge(req);
    const cookieJar = await cookies();

    const authConfig = await getAuthEdgeConfig(domain);

    if (authConfig?.type === "sso" && authConfig.partner === "workos") {
        // revoke session in WorkOS
        await revokeSessionForToken(cookieJar.get(COOKIE_FERN_TOKEN)?.value);
    }

    const logoutUrl = safeUrl(authConfig?.type === "basic_token_verification" ? authConfig.logout : undefined);

    const return_to_param = getReturnToQueryParam(authConfig);

    // if logout url is provided, append the state to it before redirecting
    const returnToParam = req.nextUrl.searchParams.get(return_to_param);
    if (returnToParam != null) {
        logoutUrl?.searchParams.set(return_to_param, returnToParam);
    }

    const redirectLocation =
        logoutUrl ??
        safeUrl(req.nextUrl.searchParams.get(return_to_param)) ??
        safeUrl(withDefaultProtocol(preferPreview(host, domain))) ??
        new URL(domain);

    // try all cookies that could set auth
    const cookiesToDelete = [COOKIE_FERN_TOKEN, COOKIE_ACCESS_TOKEN, COOKIE_REFRESH_TOKEN];

    const res = FernNextResponse.redirect(req, {
        destination: redirectLocation,
        allowedDestinations: getAllowedRedirectUrls(authConfig)
    });

    // Delete cookies by setting them with Max-Age=0 and Expires in the past
    // We need to match the domain that was used when the cookie was set
    const requestHost = host.split(":")[0] ?? host;
    const isSecure = req.nextUrl.protocol === "https:";

    for (const cookieName of cookiesToDelete) {
        // The password auth sets cookies with domain = req.nextUrl.hostname
        // We need to delete with the same domain to match
        const domainVariations = [
            requestHost, // The actual host the cookie was set on
            normalizeDomainForCookie(requestHost),
            domain, // x-fern-host domain
            normalizeDomainForCookie(domain)
        ];

        // First, try to delete without a domain (for host-only cookies)
        res.headers.append(
            "Set-Cookie",
            `${cookieName}=; Max-Age=0; Path=/; SameSite=Lax; HttpOnly; ${isSecure ? "Secure; " : ""}Expires=Thu, 01 Jan 1970 00:00:00 GMT`
        );

        // Then try each domain variation
        const uniqueDomains = [...new Set(domainVariations)];
        for (const cookieDomain of uniqueDomains) {
            res.headers.append(
                "Set-Cookie",
                `${cookieName}=; Max-Age=0; Path=/; Domain=${cookieDomain}; SameSite=Lax; HttpOnly; ${isSecure ? "Secure; " : ""}Expires=Thu, 01 Jan 1970 00:00:00 GMT`
            );
        }
    }

    return res;
}
