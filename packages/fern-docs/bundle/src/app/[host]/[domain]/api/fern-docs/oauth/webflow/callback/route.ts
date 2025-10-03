import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { WebflowClient } from "webflow-api";

import { FernNextResponse } from "@fern-api/docs-server/FernNextResponse";
import { getAllowedRedirectUrls } from "@fern-api/docs-server/auth/allowed-redirects";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { safeUrl } from "@fern-api/docs-server/safeUrl";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { withoutStaging } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";

import { redirectWithLoginError } from "@/server/redirectWithLoginError";

export async function GET(req: NextRequest): Promise<NextResponse> {
    const domain = getDocsDomainEdge(req);
    const domainWithoutStaging = withoutStaging(domain);
    const host = req.nextUrl.host;
    const config = await getAuthEdgeConfig(domainWithoutStaging);

    const code = req.nextUrl.searchParams.get("code");
    const return_to = req.nextUrl.searchParams.get(getReturnToQueryParam(config));
    const error = req.nextUrl.searchParams.get("error");
    const error_description = req.nextUrl.searchParams.get("error_description");
    const redirectLocation =
        safeUrl(return_to) ?? safeUrl(withDefaultProtocol(preferPreview(host, domainWithoutStaging)));

    if (error != null) {
        console.error(`OAuth2 error: ${error} - ${error_description}`);
        return redirectWithLoginError(req, redirectLocation, error, error_description);
    }

    if (typeof code !== "string") {
        console.error("Missing code in query params");
        return redirectWithLoginError(
            req,
            redirectLocation,
            "missing_authorization_code",
            "Couldn't login, please try again"
        );
    }

    if (config == null || config.type !== "oauth2" || config.partner !== "webflow") {
        console.log(`Invalid config for domain ${domainWithoutStaging}`);
        return redirectWithLoginError(req, redirectLocation, "config_error", "Couldn't login, please try again");
    }

    try {
        const accessToken = await WebflowClient.getAccessToken({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            redirectUri: config.redirectUri,
            code
        });

        const res = redirectLocation
            ? FernNextResponse.redirect(req, {
                  destination: redirectLocation,
                  allowedDestinations: getAllowedRedirectUrls(config)
              })
            : NextResponse.next();
        (await cookies()).set(
            "access_token",
            accessToken,
            withSecureCookie(withDefaultProtocol(preferPreview(host, domainWithoutStaging)))
        );
        return res;
    } catch (error) {
        console.error("Error getting access token", error);
        return redirectWithLoginError(req, redirectLocation, "unknown_error", "Couldn't login, please try again");
    }
}
