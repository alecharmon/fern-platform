import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { safeVerifyPasswordAuth } from "@fern-api/docs-server/auth/password-auth";
import { algoliaAppId, algoliaSearchApikey } from "@fern-api/docs-server/env-variables";
import { getDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { selectFirst } from "@fern-api/docs-server/utils/selectFirst";
import { validateApiKeyBelongsToOrg } from "@fern-api/docs-server/venus/validateApiKeyBelongsToOrg";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN, HEADER_X_FERN_BASEPATH, withoutStaging } from "@fern-api/docs-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import {
    DEFAULT_SEARCH_API_KEY_EXPIRATION_SECONDS,
    getSearchApiKey,
    SEARCH_INDEX
} from "@fern-docs/search-keyword/edge";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getBasepathRoutes } from "../../../../../../../../server/getBasepathRoutes";

export const maxDuration = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return NextResponse.json(null, { status: 200 });
    }

    if (isSelfHosted()) {
        // Return a mock Algolia key for self-hosted environments
        return NextResponse.json(
            {
                appId: "selfhosted-appid",
                apiKey: "selfhosted-apikey"
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store"
                }
            }
        );
    }

    const domain = getDocsDomainEdge(req);

    const metadata = await getDocsUrlMetadata(domain);
    if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
        return NextResponse.json(null, { status: 200 });
    }

    // Check for FERN_API_KEY header (alternative auth method, for api keys starting with "fern_")
    const fernApiKey = req.headers.get("FERN_API_KEY");
    if (fernApiKey) {
        const rolesHeader = req.headers.get("ROLES");
        return handleApiKeyAuth(req, domain, metadata.org, fernApiKey, rolesHeader);
    }

    // JWT-based authentication
    const fern_token = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;
    const authEdgeConfig = await getAuthEdgeConfig(domain);

    let user: Awaited<ReturnType<typeof safeVerifyFernJWTConfig>>;
    if (authEdgeConfig?.type === "password") {
        const jwtSecret = process.env.JWT_SECRET_KEY;
        if (jwtSecret) {
            const result = await safeVerifyPasswordAuth(fern_token, jwtSecret);
            if (result.valid) {
                user = { roles: result.roles };
            }
        }
    } else {
        user = await safeVerifyFernJWTConfig(fern_token, authEdgeConfig);
    }

    const userToken = getXUserToken(req) ?? user?.api_key ?? fern_token;

    const basepaths = await getBasepathsForSearchKey(req, domain);

    const apiKey = await getSearchApiKey({
        parentApiKey: algoliaSearchApikey(),
        domain: withoutStaging(domain),
        roles: user?.roles ?? [],
        authed: user != null,
        expiresInSeconds: DEFAULT_SEARCH_API_KEY_EXPIRATION_SECONDS,
        searchIndex: SEARCH_INDEX,
        userToken,
        basepaths
    });

    return NextResponse.json(
        {
            appId: algoliaAppId(),
            apiKey
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store"
            }
        }
    );
}

/**
 * Handle authentication using FERN_API_KEY header
 * Validates the API key belongs to the organization that owns the domain
 *
 * Optionally accepts ROLES header to specify roles for the search key.
 * Format: comma-separated list of roles (e.g., "admin,user")
 * If not provided, defaults to public content only (the "everyone" role).
 */
async function handleApiKeyAuth(
    _req: NextRequest,
    domain: string,
    orgId: string,
    apiKey: string,
    rolesHeader: string | null
): Promise<NextResponse> {
    const validation = await validateApiKeyBelongsToOrg(apiKey, orgId);

    if (!validation.valid) {
        const status = validation.error?.includes("does not belong") ? 403 : 401;
        return NextResponse.json(`Unauthorized: ${validation.error}`, { status });
    }

    // Parse desired roles from header, this will be in addition to the default "everyone" role
    let roles: string[] = [];
    if (rolesHeader) {
        roles = rolesHeader
            .split(",")
            .map((role) => role.trim())
            .filter((role) => role.length > 0);
    }

    const basepaths = await getBasepathsForSearchKey(_req, domain);

    const searchKey = await getSearchApiKey({
        parentApiKey: algoliaSearchApikey(),
        domain: withoutStaging(domain),
        roles,
        authed: true,
        expiresInSeconds: DEFAULT_SEARCH_API_KEY_EXPIRATION_SECONDS * 30,
        searchIndex: SEARCH_INDEX,
        userToken: apiKey,
        basepaths
    });

    return NextResponse.json(
        {
            appId: algoliaAppId(),
            apiKey: searchKey,
            roles: roles
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store"
            }
        }
    );
}

function getXUserToken(req: NextRequest): string | undefined {
    return selectFirst(req.headers.get("X-User-Token"));
}

async function getBasepathsForSearchKey(req: NextRequest, domain: string): Promise<string[] | undefined> {
    const currentBasepath = req.headers.get(HEADER_X_FERN_BASEPATH);
    if (!currentBasepath || currentBasepath === "/") {
        return undefined;
    }

    const allBasepaths = await getBasepathRoutes(domain);
    if (!allBasepaths) {
        return undefined;
    }

    const normalizedCurrent = currentBasepath.startsWith("/") ? currentBasepath : `/${currentBasepath}`;
    const matchingBasepaths = allBasepaths
        .map((bp) => (bp.startsWith("/") ? bp : `/${bp}`))
        .filter((bp) => bp === normalizedCurrent || bp.startsWith(`${normalizedCurrent}/`));

    console.log(
        `[getBasepathsForSearchKey] domain=${domain} currentBasepath=${normalizedCurrent} allBasepaths=[${allBasepaths.join(", ")}] matchingBasepaths=[${matchingBasepaths.join(", ")}]`
    );

    return matchingBasepaths.length > 0 ? matchingBasepaths : undefined;
}
