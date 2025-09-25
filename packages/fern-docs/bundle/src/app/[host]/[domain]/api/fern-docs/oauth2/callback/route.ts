import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { SignJWT } from "jose";

import { type FernUser, OAuth2TokenSchema } from "@fern-api/docs-auth";
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

    console.log(`Detected data payload with fields: ${Object.keys(data)}`);

    // we currently assume the token is for bearer auth
    const bearer_token = data.access_token;
    const refresh_token = data.refresh_token;
    const expires_in = data.expires_in;

    let payload: FernUser = {
      playground: {
        initial_state: {
          auth: {
            bearer_token: bearer_token,
          },
        },
      },
    };

    try {
      console.log("Attempting to parse data...");
      const parsedToken = OAuth2TokenSchema.safeParse(data);

      if (parsedToken.data) {
        console.log("Successfully parsed data.");

        if (parsedToken.data.roles) {
          console.log("Setting roles:", parsedToken.data.roles);
          const roles = Array.isArray(parsedToken.data.roles)
            ? parsedToken.data.roles
            : parsedToken.data.roles.split(" ");

          payload = {
            playground: {
              initial_state: {
                auth: {
                  bearer_token: parsedToken.data.access_token,
                },
              },
            },
            roles,
          };
        }
      }
    } catch (error) {
      console.error(error);
    }

    const fern_token = await mintJwtToken({
      payload,
      refresh_token,
      issuer,
      expires_in,
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
  refresh_token,
  issuer,
  expires_in,
}: {
  payload: Record<string, any>;
  refresh_token: string;
  issuer: string;
  expires_in: number;
}) {
  return await new SignJWT({
    fern: payload,
    refresh_token,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${expires_in} secs`) // set to any value
    .setIssuer(issuer)
    .sign(getJwtTokenSecret(process.env.OAUTH_JWT_SECRET));
}
