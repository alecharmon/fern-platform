import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { safeVerifyFernJWTConfig } from "@fern-api/docs-server/auth/FernJWT";
import { algoliaAppId, algoliaSearchApikey } from "@fern-api/docs-server/env-variables";
import { getDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { selectFirst } from "@fern-api/docs-server/utils/selectFirst";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { COOKIE_FERN_TOKEN, withoutStaging } from "@fern-api/docs-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import {
    DEFAULT_SEARCH_API_KEY_EXPIRATION_SECONDS,
    SEARCH_INDEX,
    getSearchApiKey
} from "@fern-docs/search-keyword/edge";

export const maxDuration = 10;

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return NextResponse.json("search key is not accessible in local preview mode", { status: 400 });
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
        return NextResponse.json("Search is not supported for preview URLs", {
            status: 400
        });
    }

    const fern_token = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;
    const user = await safeVerifyFernJWTConfig(fern_token, await getAuthEdgeConfig(domain));

    const userToken = getXUserToken(req) ?? user?.api_key ?? fern_token;

    const apiKey = await getSearchApiKey({
        parentApiKey: algoliaSearchApikey(),
        domain: withoutStaging(domain),
        roles: user?.roles ?? [],
        authed: user != null,
        expiresInSeconds: DEFAULT_SEARCH_API_KEY_EXPIRATION_SECONDS,
        searchIndex: SEARCH_INDEX,
        userToken
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

function getXUserToken(req: NextRequest): string | undefined {
    return selectFirst(req.headers.get("X-User-Token"));
}
