import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";

/**
 * This endpoint returns the authentication information pertaining to the current user
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isLocal() || isSelfHosted()) {
    return new NextResponse(
      "authentication is not accessible in local preview mode",
      {
        status: 400,
      }
    );
  }

  try {
    const cookieJar = await cookies();
    const fernToken = cookieJar.get(COOKIE_FERN_TOKEN)?.value;

    if (fernToken == null) {
      return NextResponse.json(
        {
          error: "User is not authenticated",
        },
        { status: 401 }
      );
    }

    const domain = getDocsDomainEdge(req);
    const config = await getAuthEdgeConfig(domain);

    if (!config) {
      return NextResponse.json(
        {
          error: "Authentication configuration not found",
        },
        { status: 500 }
      );
    }

    const userInfo = await safeVerifyFernJWTConfig(fernToken, config);
    console.log(userInfo);

    if (!userInfo) {
      return NextResponse.json(
        {
          error: "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      fern_token: fernToken,
      user_info: {
        name: userInfo.name,
        email: userInfo.email,
        roles: userInfo.roles,
      },
    });
  } catch (error) {
    console.error("Error in whoami endpoint:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
