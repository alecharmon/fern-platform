import { fernToken_admin } from "@fern-api/docs-server";
import { getRouteSuggestions, type RouteSuggestion } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

export type { RouteSuggestion };

export async function GET(req: NextRequest): Promise<NextResponse<RouteSuggestion[]>> {
    const { searchParams } = req.nextUrl;
    const docsUrl = searchParams.get("docsUrl");
    const branch = searchParams.get("branch");
    const requestedPath = searchParams.get("path");

    if (!docsUrl || !requestedPath || requestedPath === "/") {
        return NextResponse.json([]);
    }

    try {
        const session = await getCurrentSessionOrThrow();
        const host = await getHostFromHeaders();
        const fernToken = fernToken_admin() ?? session.accessToken;

        const loader = await getCachedEditableDocsLoader(
            host,
            docsUrl as EncodedDocsUrl,
            fernToken,
            branch ?? undefined
        );

        const root = await loader.getRoot();
        const collector = root ? FernNavigation.NodeCollector.collect(root) : undefined;

        const result = getRouteSuggestions(
            collector?.slugMap,
            collector?.getSlugMapWithParents(),
            FernNavigation.isPage,
            requestedPath,
            3
        );

        if (result.type === "error") {
            console.error("[route-suggestions] Error in getRouteSuggestions:", result.error, {
                docsUrl,
                branch,
                requestedPath
            });
            return NextResponse.json([]);
        }

        return NextResponse.json(result.suggestions, {
            headers: {
                "Cache-Control": "s-maxage=300, stale-while-revalidate=600" // Cache for 5 minutes
            }
        });
    } catch (error) {
        console.error("[route-suggestions] Error getting suggested routes:", error, {
            docsUrl,
            branch,
            requestedPath,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json([]);
    }
}

export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 200,
        headers: {
            Allow: "OPTIONS, GET"
        }
    });
}
