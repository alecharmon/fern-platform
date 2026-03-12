import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

/**
 * This endpoint returns the authentication information pertaining to the current user
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return new NextResponse("authentication is not accessible in local preview mode", {
            status: 400
        });
    }

    try {
        const cookieJar = await cookies();
        const fernToken = cookieJar.get(COOKIE_FERN_TOKEN)?.value;

        if (fernToken == null) {
            return NextResponse.json(
                {
                    error: "User is not authenticated - I don't know who you are!"
                },
                { status: 401 }
            );
        }

        const domain = getDocsDomainEdge(req);
        const config = await getAuthEdgeConfig(domain);

        if (!config) {
            return NextResponse.json(
                {
                    error: "Authentication configuration not found"
                },
                { status: 500 }
            );
        }

        const userInfo = await safeVerifyFernJWTConfig(fernToken, config);
        logger.debug(userInfo);

        if (!userInfo) {
            return NextResponse.json(
                {
                    error: "Invalid or expired token"
                },
                { status: 401 }
            );
        }

        return NextResponse.json({
            fern_token: fernToken,
            user_info: userInfo
        });
    } catch (error) {
        logger.error("Error in whoami endpoint:", error);
        return NextResponse.json(
            {
                error: "Internal server error"
            },
            { status: 500 }
        );
    }
}
