import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { SignJWT, decodeJwt } from "jose";

import { type FernUser, OAuthTokenResponseSchema } from "@fern-api/docs-auth";
import {
  getAllowedRedirectUrls,
  getDocsDomainEdge,
  getJwtSecretKey,
  getReturnToQueryParam,
  isLocal,
  isSelfHosted,
  withSecureCookie,
} from "@fern-api/docs-server";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { safeUrl } from "@fern-api/docs-server/safeUrl";
import { withoutStaging } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";

import { FernNextResponse } from "@/server/FernNextResponse";
import { redirectWithLoginError } from "@/server/redirectWithLoginError";

/**
 * the endpoint generalizes the oauth2 callback workflow
 * NOTE: only authorization_code flow is supported
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isLocal() || isSelfHosted()) {
    return NextResponse.json({
      enabled: false,
      returnToQueryParam: "",
    });
  }

  const domain = getDocsDomainEdge(req);
  const domainWithoutStaging = withoutStaging(domain);
  const host = req.nextUrl.host;
  const config = await getAuthEdgeConfig(domainWithoutStaging);

  if (!config) {
    console.error(
      `OAuth2 configuration missing for domain: ${domainWithoutStaging}`
    );
    return redirectWithLoginError(
      req,
      new URL(domain),
      "unexpected_config_shape",
      "Couldn't login, please try again"
    );
  }

  const return_to = req.nextUrl.searchParams.get(getReturnToQueryParam(config));
  const redirectLocation =
    safeUrl(return_to) ??
    safeUrl(withDefaultProtocol(preferPreview(host, domainWithoutStaging)));

  const code = req.nextUrl.searchParams.get("code");

  if (config.type !== "oauth2") {
    console.error("Unexpected configuration shape");
    return redirectWithLoginError(
      req,
      redirectLocation,
      "unexpected_config_shape",
      "Couldn't login, please try again"
    );
  }

  if (!("token_endpoint" in config)) {
    console.error("Missing token endpoint");
    return redirectWithLoginError(
      req,
      redirectLocation,
      "missing_token_endpoint",
      "Couldn't login, please try again"
    );
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

  const error = req.nextUrl.searchParams.get("error");
  const error_description = req.nextUrl.searchParams.get("error_description");

  if (error != null) {
    console.error(`OAuth2 error: ${error} - ${error_description}`);
    return redirectWithLoginError(
      req,
      redirectLocation,
      error,
      error_description
    );
  }

  const token_url = config.token_endpoint;
  const issuer = config.issuer ?? "https://buildwithfern.com";

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      ...(config.redirectUri && { redirect_uri: config.redirectUri }),
    });

    const response = await fetch(token_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let fern_token = "";

    const parsedToken = OAuthTokenResponseSchema.safeParse(data);
    if (!parsedToken.success) {
      console.error("Failed to parse OAuth token response:", parsedToken.error);
      return redirectWithLoginError(
        req,
        redirectLocation,
        "invalid_token_response",
        "Couldn't login, please try again"
      );
    }

    const payload: FernUser = {};

    if (config["api-key-injection-enabled"] && parsedToken.data.access_token) {
      payload.playground = {
        initial_state: {
          auth: {
            bearer_token: parsedToken.data.access_token,
          },
        },
      };
    }

    // fern:role scope indicates we should parse for user roles
    if (parsedToken.data.scope.includes("fern:role")) {
      const roles = extractRolesFromJwt(parsedToken.data.access_token);
      if (roles) {
        payload.roles = roles;
      }
    }

    fern_token = await mintJwtToken({
      payload,
      issuer,
      expires_in: parsedToken.data.expires_in,
      refresh_token: parsedToken.data.refresh_token,
    });

    const res = redirectLocation
      ? FernNextResponse.redirect(req, {
          destination: redirectLocation,
          allowedDestinations: getAllowedRedirectUrls(config),
        })
      : NextResponse.next();

    (await cookies()).set(
      "fern_token",
      fern_token,
      withSecureCookie(
        withDefaultProtocol(preferPreview(host, domainWithoutStaging))
      )
    );
    return res;
  } catch (error) {
    console.error("Error getting access token", error);
    return redirectWithLoginError(
      req,
      redirectLocation,
      "unknown_error",
      "Couldn't login, please try again"
    );
  }
}

const encoder = new TextEncoder();

function getJwtTokenSecret(secret?: string): Uint8Array {
  return encoder.encode(secret ?? getJwtSecretKey());
}

async function mintJwtToken({
  payload,
  issuer,
  expires_in,
  refresh_token,
}: {
  payload: FernUser;
  issuer: string;
  expires_in: number;
  refresh_token: string | undefined;
}): Promise<string> {
  const jwtPayload = {
    fern: payload,
    ...(refresh_token && { refresh_token }),
  };

  return await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${expires_in} secs`)
    .setIssuer(issuer)
    .sign(getJwtTokenSecret(process.env.OAUTH_JWT_SECRET));
}

/**
 * extracts roles from JWT access token
 */
function extractRolesFromJwt(accessToken: string): string[] | null {
  try {
    const decodedToken = decodeJwt(accessToken);

    if (decodedToken.roles && Array.isArray(decodedToken.roles)) {
      return decodedToken.roles as string[];
    }

    console.log("No roles found in JWT payload");
    return null;
  } catch (jwtError) {
    console.error("Failed to decode JWT:", jwtError);
    return null;
  }
}
