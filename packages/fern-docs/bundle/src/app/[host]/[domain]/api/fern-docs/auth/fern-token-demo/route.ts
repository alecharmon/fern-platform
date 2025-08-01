import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { SignJWT } from "jose";

import {
  getDocsDomainEdge,
  getJwtSecretKey,
  isLocal,
  isSelfHosted,
  withSecureCookie,
} from "@fern-api/docs-server";
import { safeUrl } from "@fern-api/docs-server";
import { preferPreview } from "@fern-api/docs-server";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getApiKeyInjectionDemoConfig } from "@fern-docs/edge-config";

import { FernNextResponse } from "@/server/FernNextResponse";
import { redirectWithLoginError } from "@/server/redirectWithLoginError";

// a demonstration of setting the fern_token JWT
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isLocal() || isSelfHosted()) {
    return NextResponse.json({
      enabled: false,
      returnToQueryParam: "",
    });
  }

  const domain = getDocsDomainEdge(req);
  const host = req.nextUrl.host;

  // fetch the user's api credentials
  const config = await getApiKeyInjectionDemoConfig(domain);
  const apiKey = config?.apiKey;

  // use the state param to determine redirect location
  const return_to = req.nextUrl.searchParams.get("state");
  const redirectLocation =
    safeUrl(return_to) ??
    safeUrl(withDefaultProtocol(preferPreview(host, domain)));

  // if the key isn't found, redirect as necessary
  if (typeof apiKey !== "string") {
    return redirectWithLoginError(
      req,
      redirectLocation,
      "missing_api_key",
      "Couldn't login, please try again"
    );
  }

  if (typeof config?.secret !== "string") {
    return redirectWithLoginError(
      req,
      redirectLocation,
      "missing_secret",
      "Couldn't login, please try again"
    );
  }

  // mint the jwt using the secret key
  const fern_token = await mintJwtToken({
    secret: config.secret,
    apiKey,
    payload: config.payload,
  });

  // if the token isn't set properly, redirect as necessary
  if (!fern_token) {
    return redirectWithLoginError(
      req,
      redirectLocation,
      "failed to create fern_token",
      "Couldn't login, please try again"
    );
  }

  // set the fern_token as a cookie on the docs domain
  const cookieJar = await cookies();
  cookieJar.set(
    "fern_token",
    fern_token,
    withSecureCookie(withDefaultProtocol(preferPreview(host, domain)))
  );

  // redirect the user
  return FernNextResponse.redirect(req, {
    destination: redirectLocation,
  });
}

const encoder = new TextEncoder();

function getJwtTokenSecret(secret?: string): Uint8Array {
  return encoder.encode(secret ?? getJwtSecretKey());
}

async function mintJwtToken({
  secret,
  apiKey,
  payload,
}: {
  secret: string;
  apiKey: string;
  payload?: any;
}) {
  return await new SignJWT(
    payload ?? {
      fern: {
        playground: {
          initial_state: {
            auth: {
              bearer_token: apiKey,
            },
          },
        },
      },
    }
  )
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1d") // set to any value
    .setIssuer("https://buildwithfern.com")
    .sign(getJwtTokenSecret(secret)); // sign using the secret provided by fern
}
