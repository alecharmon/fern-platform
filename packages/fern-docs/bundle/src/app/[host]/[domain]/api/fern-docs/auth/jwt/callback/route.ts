import { getAuthMethodId } from "@fern-api/docs-auth";
import { getAllowedRedirectUrls } from "@fern-api/docs-server/auth/allowed-redirects";
import { safeVerifyFernJWTConfig, signFernJWT } from "@fern-api/docs-server/auth/FernJWT";
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
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { redirectWithLoginError } from "@/server/redirectWithLoginError";

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        return new NextResponse("jwt is not accessible in local preview mode", {
            status: 400
        });
    }

    const domain = getDocsDomainEdge(req);
    const host = req.nextUrl.host;
    const edgeConfig = await getAuthEdgeConfig(domain);

    // since we expect the callback to be redirected to, the token will be in the query params
    const token = req.nextUrl.searchParams.get(COOKIE_FERN_TOKEN);
    const returnTo = req.nextUrl.searchParams.get(getReturnToQueryParam(edgeConfig));
    const redirectLocation = safeUrl(returnTo) ?? safeUrl(withDefaultProtocol(preferPreview(host, domain)));
    console.log("Redirecting", host, domain, redirectLocation);

    if (edgeConfig?.type !== "basic_token_verification" || token == null) {
        console.error(`Invalid config for domain ${domain}`);
        return redirectWithLoginError(req, redirectLocation, "unknown_error", "Couldn't login, please try again");
    }

    const fernUser = await safeVerifyFernJWTConfig(token, edgeConfig);

    if (fernUser == null) {
        return redirectWithLoginError(req, redirectLocation, "unknown_error", "Couldn't login, please try again");
    }

    // Re-sign the token with auth method included
    const authMethod = getAuthMethodId(edgeConfig);
    const newToken = await signFernJWT(fernUser, { authMethod });

    const res = redirectLocation
        ? FernNextResponse.redirect(req, {
              destination: redirectLocation,
              allowedDestinations: getAllowedRedirectUrls(edgeConfig)
          })
        : NextResponse.next();

    const cookieJar = await cookies();
    cookieJar.set(COOKIE_FERN_TOKEN, newToken, withSecureCookie(withDefaultProtocol(host)));

    return res;
}
