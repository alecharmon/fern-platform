import * as FernNavigation from "@fern-api/fdr-sdk/navigation";

export const ROOT_SLUG_ALIAS = "root";

/** Recreated Auth0OrgName type for nominal typing */
export type Auth0OrgNameIsh = string & { __Auth0OrgName: void };

/** Recreated EncodedDocsUrl type for nominal typing */
export type EncodedDocsUrlIsh = string & { __encodedDocsUrl: void };

export function constructEditorSlug({
    orgName,
    docsUrl,
    branchName,
    slug
}: {
    orgName: Auth0OrgNameIsh;
    docsUrl: EncodedDocsUrlIsh;
    branchName: string;
    slug: string;
}) {
    return `/${orgName}/editor/${docsUrl}/${branchName}/${slug}`;
}

/**
 * Determines if a navigation node needs to be redirected, and if so, returns the target slug.
 * This handles:
 * - sections without pageId -> redirect to the first page within the section
 * - notFound nodes -> redirect to ROOT_SLUG_ALIAS (or null if already at root)
 * - redirect nodes -> redirect to the specified target
 */
export function getEditorRedirectSlug({
    navigationNode,
    navigationSlug,
    root
}: {
    navigationNode: FernNavigation.utils.Node;
    navigationSlug: string;
    root: FernNavigation.RootNode;
}): string | null {
    // Handle sections without pageId
    if (navigationNode.type === "found" && navigationNode.node.type === "section") {
        const pageId = FernNavigation.getPageId(navigationNode.node);
        if (!pageId) {
            const firstPageNode = findFirstPageNode(navigationNode.node);
            if (firstPageNode) {
                // Redirect to first page in section
                return firstPageNode.slug;
            }
        }
    }

    if (navigationNode.type === "notFound") {
        // If we're at the root slug and still not found, throw to prevent infinite loop
        // NOTE: the root slug is not always the root page
        // e.g. elevenlabs' root slug == "/docs", but root page is "/docs/overview"
        if (navigationSlug === root.slug) {
            // Caller typically should throw 404 when navigationNode.type === "notFound"
            return null;
        }

        // Redirect to root slug
        return ROOT_SLUG_ALIAS;
    }

    if (navigationNode.type === "redirect") {
        // Redirect to the specified target
        return navigationNode.redirect;
    }

    // No redirect needed
    return null;
}

/** Recursively finds the first page node within a navigation tree */
function findFirstPageNode(
    node: FernNavigation.NavigationNodePage | FernNavigation.NavigationChild
): FernNavigation.NavigationNodePage | undefined {
    if (FernNavigation.isPage(node)) {
        return node;
    }
    if (node.type === "section" && node.children && node.children.length > 0) {
        for (const child of node.children) {
            const foundPageNode = findFirstPageNode(child);
            if (foundPageNode) {
                return foundPageNode;
            }
        }
    }
    return undefined;
}

/**
 * Returns the navigation slug to use for the requested slug, taking into account the root alias. This
 * is used within the Editor to ensure that first land into editor (which uses a root alias) calculates
 * the correct navigation slug to use.
 *
 * @param requestedSlug - The slug to find the navigation node for
 * @param root - The root node of the navigation tree
 * @returns The navigation slug to use for the requested slug, taking into account the root alias
 */
export function getRootAliasAwareNavigationSlug(
    requestedSlug: string,
    root: FernNavigation.RootNode
): FernNavigation.Slug {
    return requestedSlug === ROOT_SLUG_ALIAS ? root.slug : FernNavigation.Slug(requestedSlug);
}
