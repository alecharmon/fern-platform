"use server";

import { createCachedDocsLoader, encodeDocsLoaderDomain } from "@fern-api/docs-loader";
import { fernToken_admin } from "@fern-api/docs-server";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";

/**
 * Get all valid page paths for a docs site for autocomplete
 */
export async function getValidPagePaths(docsUrl: string): Promise<{
    success: boolean;
    paths?: string[];
    error?: string;
}> {
    try {
        const session = await getCurrentSessionOrThrow();
        const domain = decodeURIComponent(docsUrl);
        const rootDomain = domain.match(/(?:https?:\/\/)?([^/]+)/)?.[1] || domain;

        const loader = await createCachedDocsLoader(
            rootDomain,
            encodeDocsLoaderDomain(domain),
            fernToken_admin() ?? session.accessToken,
            {
                skipAuth: true
            }
        );

        const root = await loader.getRoot();
        if (!root) {
            return { success: false, error: "Failed to load navigation" };
        }

        const paths: string[] = [];

        const extractPaths = (node: unknown, basePath: string = ""): void => {
            if (!node || typeof node !== "object") return;

            const nodeObj = node as Record<string, unknown>;

            // Handle slug if present
            if ("slug" in nodeObj && typeof nodeObj.slug === "string") {
                const fullPath = basePath + "/" + nodeObj.slug;
                paths.push(fullPath);
            }

            // Handle root node's child property (singular)
            if ("child" in nodeObj && nodeObj.child) {
                extractPaths(nodeObj.child, basePath);
            }

            // Handle children array (for productgroup, section, etc.)
            if ("children" in nodeObj && Array.isArray(nodeObj.children)) {
                const currentPath =
                    "slug" in nodeObj && typeof nodeObj.slug === "string" ? basePath + "/" + nodeObj.slug : basePath;

                for (const child of nodeObj.children) {
                    extractPaths(child, currentPath);
                }
            }

            // Handle items array
            if ("items" in nodeObj && Array.isArray(nodeObj.items)) {
                for (const item of nodeObj.items) {
                    extractPaths(item, basePath);
                }
            }

            // Handle tabs array
            if ("tabs" in nodeObj && Array.isArray(nodeObj.tabs)) {
                for (const tab of nodeObj.tabs) {
                    extractPaths(tab, basePath);
                }
            }
        };

        extractPaths(root);

        const uniquePaths = Array.from(new Set(paths)).sort();

        console.log("uniquePaths!!", uniquePaths);

        return { success: true, paths: uniquePaths };
    } catch (error) {
        console.error("Failed to get valid page paths", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred"
        };
    }
}
