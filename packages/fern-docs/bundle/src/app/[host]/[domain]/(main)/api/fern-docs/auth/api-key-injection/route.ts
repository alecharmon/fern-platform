import type { APIKeyInjectionConfig } from "@fern-api/docs-auth";
import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { getOAuth2AuthorizationUrl } from "@fern-api/docs-server/auth/oauth2";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { getReturnToQueryParam } from "@fern-api/docs-server/auth/return-to";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { getJwtSecretKey } from "@fern-api/docs-server/auth/workos";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN, removeTrailingSlash } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getApiKeyInjectionEdgeConfig, getAuthEdgeConfig } from "@fern-docs/edge-config";
import { decodeJwt, SignJWT } from "jose";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import urlJoin from "url-join";

export async function GET(req: NextRequest): Promise<NextResponse<APIKeyInjectionConfig>> {
    if (isLocal()) {
        return NextResponse.json({
            enabled: false,
            returnToQueryParam: ""
        });
    }

    const domain = getDocsDomainEdge(req);
    const host = req.nextUrl.host;
    const cookieJar = await cookies();

    const authEdgeConfig = await getAuthEdgeConfig(domain);
    const apiKeyEdgeConfig = await getApiKeyInjectionEdgeConfig(domain);
    const edgeConfig = authEdgeConfig || apiKeyEdgeConfig;

    const returnToQueryParam = getReturnToQueryParam(edgeConfig);

    // User JWT: check request header first (for server-to-server calls), then cookie (for browser calls).
    // This follows the same pattern as other routes (search/key, auth/verify, llms.txt, etc.)
    const fern_token = req.headers.get("FERN_TOKEN") ?? cookieJar.get(COOKIE_FERN_TOKEN)?.value;
    const fernUser = await safeVerifyFernJWTConfig(fern_token, edgeConfig);

    // if the JWT is valid, and the user has an API key, return it
    if (fernUser?.api_key != null) {
        return NextResponse.json({
            enabled: true,
            authenticated: true,
            access_token: fernUser.api_key,
            returnToQueryParam
        });
    }

    if (fernUser?.playground?.initial_state?.auth?.bearer_token) {
        return NextResponse.json({
            enabled: true,
            authenticated: true,
            access_token: fernUser.playground.initial_state.auth.bearer_token,
            returnToQueryParam
        });
    }

    if (fernUser?.playground?.initial_state?.auth?.basic) {
        return NextResponse.json({
            enabled: true,
            authenticated: true,
            access_token: `${fernUser.playground.initial_state.auth.basic.username}:${fernUser.playground.initial_state.auth.basic.password}`,
            returnToQueryParam
        });
    }

    if (!edgeConfig) {
        return NextResponse.json({
            enabled: false,
            returnToQueryParam
        });
    }

    if (
        authEdgeConfig &&
        authEdgeConfig.type === "basic_token_verification" &&
        authEdgeConfig["api-key-injection-enabled"]
    ) {
        if (!authEdgeConfig.redirect) {
            return NextResponse.json({
                enabled: false,
                returnToQueryParam
            });
        }

        return NextResponse.json({
            enabled: true,
            authenticated: false,
            authorizationUrl: authEdgeConfig.redirect,
            returnToQueryParam
        });
    }

    if (apiKeyEdgeConfig && apiKeyEdgeConfig.type === "basic_token_verification") {
        if (!apiKeyEdgeConfig.redirect) {
            return NextResponse.json({
                enabled: false,
                returnToQueryParam
            });
        }

        return NextResponse.json({
            enabled: true,
            authenticated: false,
            authorizationUrl: apiKeyEdgeConfig.redirect,
            returnToQueryParam
        });
    }

    if (
        edgeConfig.type === "sso" ||
        edgeConfig.type === "password" ||
        !("api-key-injection-enabled" in edgeConfig) ||
        edgeConfig["api-key-injection-enabled"] !== true
    ) {
        return NextResponse.json({
            enabled: false,
            returnToQueryParam
        });
    }

    if (edgeConfig.type !== "oauth2") {
        return NextResponse.json({
            enabled: false,
            returnToQueryParam
        });
    }

    if (edgeConfig.type === "oauth2" && "auth_endpoint" in edgeConfig) {
        if (fern_token && edgeConfig["api-key-injection-enabled"]) {
            try {
                const decodedToken = decodeJwt(fern_token);
                const refresh_token = decodedToken.refresh_token as string | undefined;

                if (refresh_token && edgeConfig.token_endpoint) {
                    const token_url = `${edgeConfig.token_endpoint}?grant_type=refresh_token&client_id=${edgeConfig.clientId}&client_secret=${edgeConfig.clientSecret}&refresh_token=${refresh_token}`;

                    const response = await fetch(token_url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const new_access_token = data.access_token;
                        const new_refresh_token = data.refresh_token;
                        const expires_in = data.expires_in;

                        const new_fern_token = await mintJwtToken({
                            bearer_token: new_access_token,
                            refresh_token: new_refresh_token || refresh_token,
                            issuer: edgeConfig.issuer || "https://buildwithfern.com",
                            expires_in
                        });

                        cookieJar.set(
                            "fern_token",
                            new_fern_token,
                            withSecureCookie(withDefaultProtocol(preferPreview(host, domain)))
                        );

                        return NextResponse.json({
                            enabled: true,
                            authenticated: true,
                            access_token: new_access_token,
                            returnToQueryParam
                        });
                    }
                }
            } catch (error) {
                logger.error("[api-key-injection] Error refreshing token:", error);
            }
        }

        if (edgeConfig["api-key-injection-enabled"]) {
            return NextResponse.json({
                enabled: true,
                authenticated: false,
                authorizationUrl: getOAuth2AuthorizationUrl(edgeConfig, {
                    redirectUri: urlJoin(
                        removeTrailingSlash(withDefaultProtocol(preferPreview(host, domain))),
                        "/api/fern-docs/oauth2/callback"
                    )
                }),
                returnToQueryParam
            });
        }

        return NextResponse.json({
            enabled: false,
            returnToQueryParam
        });
    }

    return NextResponse.json({
        enabled: false,
        returnToQueryParam
    });
}

const encoder = new TextEncoder();

function getJwtTokenSecret(secret?: string): Uint8Array {
    return encoder.encode(secret ?? getJwtSecretKey());
}

async function mintJwtToken({
    bearer_token,
    refresh_token,
    issuer,
    expires_in
}: {
    bearer_token: string;
    refresh_token: string;
    issuer: string;
    expires_in: number;
}) {
    return await new SignJWT({
        fern: {
            playground: {
                initial_state: {
                    auth: {
                        bearer_token: bearer_token
                    }
                }
            }
        },
        refresh_token: refresh_token
    })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime(`${expires_in} secs`)
        .setIssuer(issuer)
        .sign(getJwtTokenSecret(process.env.OAUTH_JWT_SECRET));
}
