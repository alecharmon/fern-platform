import type { FernNavigation } from "@fern-api/fdr-sdk";
import { generateNavigationSubtitle } from "./navigation-subtitle";
import { findSimilarPaths } from "./path-similarity";
import { slugToHref } from "./slug-to-href";

export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
    subtitle?: string;
}

export type GetRouteSuggestionsResult =
    | { type: "ok"; suggestions: RouteSuggestion[] }
    | { type: "error"; error: "NO_SLUG_MAP" | "NO_NODES" | "NO_PAGES" };

export function getRouteSuggestions(
    slugMap: ReadonlyMap<string, FernNavigation.NavigationNode> | undefined,
    slugMapWithParents: ReturnType<FernNavigation.NodeCollector["getSlugMapWithParents"]> | undefined,
    isPage: <N extends FernNavigation.NavigationNode>(node: N) => node is N & FernNavigation.NavigationNodePage,
    requestedPath: string,
    similarPathsLimit = 3
): GetRouteSuggestionsResult {
    if (!requestedPath || requestedPath === "/") {
        return { type: "ok", suggestions: [] };
    }

    if (!slugMap || slugMap.size === 0 || !slugMapWithParents) {
        return { type: "error", error: "NO_SLUG_MAP" };
    }
    const allNodes = Array.from(slugMap.entries());
    if (allNodes.length === 0) {
        return { type: "error", error: "NO_NODES" };
    }

    const availablePaths = allNodes.flatMap(([slug, node]) => {
        if (!isPage(node) || node.hidden || node.authed) {
            return [];
        }
        return [
            {
                slug,
                title: node.title,
                href: slugToHref(node.canonicalSlug ?? slug),
                subtitle: generateNavigationSubtitle(node, slugMapWithParents)
            }
        ];
    });

    if (availablePaths.length === 0) {
        return { type: "error", error: "NO_PAGES" };
    }

    return { type: "ok", suggestions: findSimilarPaths(requestedPath, availablePaths, similarPathsLimit) };
}
