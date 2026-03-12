import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getRouteSuggestions, type RouteSuggestion } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { logger } from "@fern-api/ui-core-utils/logger";
import { type NextRequest, NextResponse } from "next/server";

export type { RouteSuggestion };

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse<RouteSuggestion[]>> {
    const { host, domain } = await props.params;
    const { searchParams } = req.nextUrl;
    const requestedPath = searchParams.get("path");

    if (!requestedPath || requestedPath === "/") {
        return NextResponse.json([]);
    }

    try {
        const loader = await createCachedDocsLoader(host, domain);
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
            logger.error("[route-suggestions] Error in getRouteSuggestions:", result.error, {
                host,
                domain,
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
        logger.error("[route-suggestions] Error getting suggested routes:", error, {
            host,
            domain,
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
