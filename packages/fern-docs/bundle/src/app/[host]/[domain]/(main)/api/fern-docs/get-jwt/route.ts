import { signFernJWT } from "@fern-api/docs-server/auth/FernJWT";
import { getDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { validateApiKeyBelongsToOrg } from "@fern-api/docs-server/venus/validateApiKeyBelongsToOrg";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return NextResponse.json({ error: "JWT generation is not accessible in local preview mode" }, { status: 400 });
    }

    if (isSelfHosted()) {
        return NextResponse.json(
            { error: "JWT generation is not supported in self-hosted environments" },
            { status: 400 }
        );
    }

    const domain = getDocsDomainEdge(req);

    const fernApiKey = req.headers.get("FERN_API_KEY");
    if (!fernApiKey) {
        return NextResponse.json({ error: "Missing FERN_API_KEY header" }, { status: 401 });
    }

    const metadata = await getDocsUrlMetadata(domain);
    const validation = await validateApiKeyBelongsToOrg(fernApiKey, metadata.org);

    if (!validation.valid) {
        const status = validation.error?.includes("does not belong") ? 403 : 401;
        return NextResponse.json({ error: `Unauthorized: ${validation.error}` }, { status });
    }

    const authConfig = await getAuthEdgeConfig(domain);
    if (!authConfig) {
        return NextResponse.json({ error: "No authentication configuration found for this domain" }, { status: 500 });
    }

    if (authConfig.type === "sso" && authConfig.partner === "workos") {
        return NextResponse.json(
            {
                error: "SSO/WorkOS authentication is not supported by this endpoint. This endpoint is for API key-based authentication only."
            },
            { status: 400 }
        );
    }

    const secret =
        authConfig.type === "basic_token_verification"
            ? authConfig.secret
            : authConfig.type === "oauth2"
              ? process.env.OAUTH_JWT_SECRET
              : undefined;

    if (authConfig.type === "oauth2" && !secret) {
        return NextResponse.json(
            { error: "Missing OAUTH_JWT_SECRET configuration for oauth2 authentication" },
            { status: 500 }
        );
    }

    const rolesHeader = req.headers.get("ROLES");
    let roles: string[] = [];
    if (rolesHeader) {
        roles = rolesHeader
            .split(",")
            .map((role) => role.trim())
            .filter((role) => role.length > 0);
    }

    let issuer: string | undefined;
    if (authConfig.type === "basic_token_verification") {
        issuer = authConfig.issuer;
    } else if (authConfig.type === "oauth2" && "issuer" in authConfig) {
        issuer = authConfig.issuer;
    }

    try {
        const fern_token = await signFernJWT(
            {
                roles,
                api_key: fernApiKey
            },
            {
                secret,
                issuer
            }
        );

        return NextResponse.json(
            {
                fern_token,
                roles
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store"
                }
            }
        );
    } catch (error) {
        logger.error("[get-jwt] Error generating JWT:", error);
        return NextResponse.json({ error: "Failed to generate JWT token" }, { status: 500 });
    }
}
