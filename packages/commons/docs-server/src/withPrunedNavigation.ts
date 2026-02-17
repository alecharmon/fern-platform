import * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import type { DocsLoader } from "./docs-loader";
import { SKIP } from "./node-navigation";

interface WithPrunedSidebarOpts {
    /**
     * If provided, hidden nodes in this list will not be pruned
     */
    visibleNodeIds?: FernNavigation.NodeId[];

    /**
     * If true, authenticated pages will not be pruned
     */
    authed: boolean;

    /**
     * If true, authenticated pages will not be pruned because they are discoverable
     */
    discoverable?: true;

    /**
     * If true, hidden nodes will not be pruned (used by the editor to show hidden pages)
     */
    showHidden?: boolean;
}

/**
 * This function checks if a node is visible by traversing the node and all its children.
 * If current node or any of its children are in the set of visible node ids, the node is visible.
 *
 * @param node the node to check
 * @param visibleNodeIds the set of node ids that are visible
 * @returns true if the node is visible, false otherwise
 */
function isVisible(node: FernNavigation.NavigationNode, visibleNodeIds: Set<FernNavigation.NodeId>): boolean {
    let visible = false;

    if (visibleNodeIds.size === 0) {
        return visible;
    }

    if (visibleNodeIds.has(node.id)) {
        visible = true;
    }

    FernNavigation.traverseBF(node, (node) => {
        if (visibleNodeIds.has(node.id)) {
            visible = true;
            return false;
        }
        return true;
    });

    return visible;
}

/**
 * Note: at the stage of calling this function, the RBAC should already been evaluated (and nodes are completely filtered out that are not visible to the current user).
 * @returns true if the node should be included, false otherwise
 */
export function pruneNavigationPredicate(
    node: FernNavigation.NavigationNode,
    { visibleNodeIds, authed, discoverable, showHidden }: WithPrunedSidebarOpts
): boolean {
    // prune authenticated pages (unless the discoverable flag is turned on)
    if (FernNavigation.isPage(node) && node.authed && !authed && !discoverable) {
        return false;
    }

    // then, prune hidden nodes, unless it is the current node
    if (FernNavigation.hasMetadata(node) && node.hidden) {
        if (showHidden || isVisible(node, new Set(visibleNodeIds))) {
            return true;
        }
        return false;
    }

    // finally, prune nodes that are not pages and have no children (avoid pruning links)
    if (!FernNavigation.isPage(node) && !FernNavigation.isLeaf(node)) {
        return FernNavigation.getChildren(node).length > 0;
    }

    return true;
}

export function withPrunedNavigation<NODE extends FernNavigation.NavigationNode>(
    node: NODE | undefined,
    opts: WithPrunedSidebarOpts
): NODE | undefined {
    if (!node) {
        return node;
    }

    FernNavigation.traverseBF(node, (node, parents) => {
        if (opts.visibleNodeIds?.includes(node.id) && FernNavigation.hasMetadata(node) && node.hidden) {
            return SKIP;
        }

        const parent = parents[parents.length - 1];

        if (parent && FernNavigation.hasMetadata(parent) && parent.hidden && FernNavigation.hasMetadata(node)) {
            node.hidden = true;
        }

        // Inherit API playground settings from the nearest apiReference ancestor when undefined on leaves
        const apiRefAncestor = parents.find((p): p is FernNavigation.ApiReferenceNode => p.type === "apiReference");
        if (
            apiRefAncestor &&
            ((node as any).type === "endpoint" || (node as any).type === "webSocket") &&
            (node as any).playground == null &&
            apiRefAncestor.playground != null
        ) {
            // safe mutation: these navigation nodes are mutable server-side
            (node as any).playground = apiRefAncestor.playground;
        }

        return true;
    });

    return FernNavigation.Pruner.from(node)
        .keep((n) => pruneNavigationPredicate(n, opts))
        .get();
}

export async function withPrunedNavigationLoader<NODE extends FernNavigation.NavigationNode>(
    node: NODE | undefined,
    loader: DocsLoader,
    visibleNodeIds: FernNavigation.NodeId[] | undefined
): Promise<NODE | undefined> {
    const returned = withPrunedNavigation(node, {
        visibleNodeIds,
        authed: (await loader.getAuthState()).authed,
        // when true, all unauthed pages are visible, but rendered with a LOCK button
        // so they're not actually "pruned" from the sidebar
        // TODO: move this out of a feature flag and into the navigation node metadata
        discoverable: (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable ? (true as const) : undefined
    });

    return returned;
}
