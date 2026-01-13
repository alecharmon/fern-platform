import { safeVerifyFernJWTWithMultipleConfigs } from "@fern-api/docs-server/auth/FernJWT";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { getAuthEdgeConfigs } from "@fern-docs/edge-config";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;
export const revalidate = 0;

interface VerifyAuthResponse {
    authenticated: boolean;
    user?: {
        name?: string;
        email?: string;
        roles?: string[];
    };
}

interface VerifyAuthError {
    authenticated: false;
    error: string;
}

export async function POST(req: NextRequest): Promise<NextResponse<VerifyAuthResponse | VerifyAuthError>> {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json(
            {
                authenticated: false,
                error: "Authentication verification is not available in local preview mode or self-hosted mode"
            },
            { status: 400 }
        );
    }

    try {
        const domain = getDocsDomainEdge(req);

        const fernToken = req.headers.get("FERN_TOKEN") ?? req.cookies.get(COOKIE_FERN_TOKEN)?.value;

        if (!fernToken) {
            return NextResponse.json({
                authenticated: false
            });
        }

        const configs = await getAuthEdgeConfigs(domain);

        if (configs.length === 0) {
            return NextResponse.json({
                authenticated: false
            });
        }

        const userInfo = await safeVerifyFernJWTWithMultipleConfigs(fernToken, configs);

        if (!userInfo) {
            return NextResponse.json({
                authenticated: false
            });
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                name: userInfo.name,
                email: userInfo.email,
                roles: userInfo.roles
            }
        });
    } catch (error) {
        console.error("Error in auth/verify endpoint:", error);
        return NextResponse.json(
            {
                authenticated: false,
                error: "Internal server error"
            },
            { status: 500 }
        );
    }
}
