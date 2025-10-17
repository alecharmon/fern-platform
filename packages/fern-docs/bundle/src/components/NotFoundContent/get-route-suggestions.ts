"use server";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getDocsHostApp } from "@fern-api/docs-server/xfernhost/app";
import { HEADER_X_FERN_HOST, slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { headers } from "next/headers";
import { findSimilarPaths } from "../../utils/path-similarity";

export interface RouteSuggestion {
    slug: string;
    title: string;
    href: string;
    score: number;
}

export async function getRouteSuggestions(requestedPath: string): Promise<RouteSuggestion[]> {
    if (!requestedPath || requestedPath === "/") {
        return [];
    }

    try {
        const headersList = await headers();
        const domain = headersList.get(HEADER_X_FERN_HOST);
        const host = await getDocsHostApp();

        if (!domain) {
            console.error("[getRouteSuggestions] Missing domain header");
            return [];
        }

        if (!host) {
            console.error("[getRouteSuggestions] Missing host");
            return [];
        }

        const loader = await createCachedDocsLoader(host, domain);
        const root = await loader.getRoot();

        if (!root) {
            console.error("[getRouteSuggestions] No root navigation found for domain:", domain);
            return [];
        }

        const collector = FernNavigation.NodeCollector.collect(root);
        const allNodes = Array.from(collector.slugMap.entries());

        if (allNodes.length === 0) {
            console.error("[getRouteSuggestions] No nodes found in navigation");
            return [];
        }

        const availablePaths = allNodes
            .filter(([, node]) => FernNavigation.isPage(node) && !node.hidden && !node.authed)
            .map(([slug, node]) => ({
                slug,
                title: node.title,
                href: slugToHref(slug)
            }));

        if (availablePaths.length === 0) {
            console.error("[getRouteSuggestions] No available paths after filtering");
            return [];
        }

        const suggestions = findSimilarPaths(requestedPath, availablePaths, 3);

        return suggestions;
    } catch (error) {
        console.error("[getRouteSuggestions] Error getting suggested routes:", error, {
            requestedPath,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return [];
    }
}
