import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { type NextRequest, NextResponse } from "next/server";
import { findSimilarPaths } from "@/utils/path-similarity";

export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
    subtitle?: string;
}

/**
 * Generate a breadcrumb-style subtitle from parent navigation nodes
 */
function generateSubtitle(
    node: FernNavigation.NavigationNodeWithMetadata,
    slugMapWithParents: ReadonlyMap<
        string,
        { node: FernNavigation.NavigationNodeWithMetadata; parents: readonly FernNavigation.NavigationNodeParent[] }
    >
): string | undefined {
    const entry = slugMapWithParents.get(node.slug);
    if (!entry?.parents || entry.parents.length === 0) {
        // If it's a product node, use its subtitle
        if (node.type === "product" && "subtitle" in node) {
            return node.subtitle;
        }
        return undefined;
    }

    // Build breadcrumb from parents, excluding root
    const breadcrumbParts = entry.parents
        .filter((parent) => parent.type !== "root" && parent.type !== "sidebarRoot")
        .map((parent) => ("title" in parent ? parent.title : undefined))
        .filter((title): title is string => title != null && title.length > 0);

    return breadcrumbParts.length > 0 ? breadcrumbParts.join(" › ") : undefined;
}

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

        if (!root) {
            console.error("[route-suggestions] No root navigation found for domain:", domain);
            return NextResponse.json([]);
        }

        const collector = FernNavigation.NodeCollector.collect(root);
        const allNodes = Array.from(collector.slugMap.entries());
        const slugMapWithParents = collector.getSlugMapWithParents();

        if (allNodes.length === 0) {
            console.error("[route-suggestions] No nodes found in navigation");
            return NextResponse.json([]);
        }

        const availablePaths = allNodes
            .filter(([, node]) => FernNavigation.isPage(node) && !node.hidden && !node.authed)
            .map(([slug, node]) => ({
                slug,
                title: node.title,
                // Use canonicalSlug for href generation to ensure proper deduplication
                // when multiple slugs point to the same canonical page
                href: slugToHref(node.canonicalSlug ?? slug),
                subtitle: generateSubtitle(node, slugMapWithParents)
            }));

        if (availablePaths.length === 0) {
            console.error("[route-suggestions] No available paths after filtering");
            return NextResponse.json([]);
        }

        const suggestions = findSimilarPaths(requestedPath, availablePaths, 3);

        return NextResponse.json(suggestions, {
            headers: {
                "Cache-Control": "s-maxage=300, stale-while-revalidate=600" // Cache for 5 minutes
            }
        });
    } catch (error) {
        console.error("[route-suggestions] Error getting suggested routes:", error, {
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
