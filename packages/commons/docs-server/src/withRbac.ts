import "server-only";

import type { PathnameViewerRules } from "@fern-api/docs-auth";
import { EVERYONE_ROLE, matchPath, slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import {
    hasMetadata,
    type NavigationNode,
    type NavigationNodeParent,
    Pruner,
    type RootNode
} from "@fern-api/fdr-sdk/navigation";
import { EMPTY_ARRAY } from "@fern-api/ui-core-utils";

import type { AuthState } from "./auth/getAuthState";

export enum Gate {
    DENY,
    ALLOW
}

/**
 * @returns true if the request should should be denied
 */
export function withBasicTokenAnonymous(auth: PathnameViewerRules, pathname: string): Gate {
    // if the path is in the denylist, deny the request
    if (auth.denylist?.find((path) => matchPath(path, pathname))) {
        return Gate.DENY;
    }

    // if the path is in the allowlist, allow the request to pass through
    if (
        auth.allowlist?.find((path) => matchPath(path, pathname)) ||
        auth.anonymous?.find((path) => matchPath(path, pathname))
    ) {
        return Gate.ALLOW;
    }

    // if the path is not in the allowlist, deny the request
    return Gate.DENY;
}

/**
 * @internal visibleForTesting
 */
export function withBasicTokenAnonymousCheck(
    auth: PathnameViewerRules
): (node: Partial<NavigationNode>, parents?: readonly NavigationNodeParent[]) => Gate {
    return (node, parents = EMPTY_ARRAY) => {
        if (hasMetadata(node) && withBasicTokenAnonymous(auth, slugToHref(node.slug)) === Gate.ALLOW) {
            return Gate.ALLOW;
        }

        // Note: this was causing random edge nodes to show "authed=true"
        // TODO: decide if we should keep this or remove it
        // if (
        //     hasMetadata(node) &&
        //     !isPage(node as NavigationNode) &&
        //     withBasicTokenAnonymous(auth, slugToHref(node.slug)) === Gate.DENY
        // ) {
        //     return Gate.DENY;
        // }

        const predicate = rbacViewGate([], false);

        return predicate(node as unknown as NavigationNode, parents);
    };
}

function withDenied<T extends (...args: any[]) => Gate>(predicate: T): (...args: Parameters<T>) => boolean {
    return (...args) => predicate(...args) === Gate.DENY;
}

function withAllowed<T extends (...args: any[]) => Gate>(predicate: T): (...args: Parameters<T>) => boolean {
    return (...args) => predicate(...args) === Gate.ALLOW;
}

export function pruneWithBasicTokenAnonymous(auth: PathnameViewerRules, node: RootNode): RootNode {
    const result = Pruner.from(node)
        // mark nodes that are authed
        .authed(withDenied(withBasicTokenAnonymousCheck(auth)))
        .get();

    // TODO: handle this more gracefully
    if (result == null) {
        throw new Error("Failed to prune navigation tree");
    }

    return result;
}

/**
 * @internal
 * @param roles current viewer's roles
 * @param filters rbac filters for the current node
 * @param authed whether the viewer is authenticated
 * @returns true if the roles matches the filters (i.e. the viewer is allowed to view the node)
 */
export function matchRoles(roles: string[] | "anonymous", filters: string[][]): Gate {
    // filters must include "everyone" if the viewer is authenticated
    if (filters.length === 0 || filters.every((filter) => filter.length === 0)) {
        return roles === "anonymous" ? Gate.DENY : Gate.ALLOW;
    }

    roles = roles === "anonymous" ? [EVERYONE_ROLE] : [EVERYONE_ROLE, ...roles];
    return filters.every((filter) => filter.some((aud) => roles.includes(aud))) ? Gate.ALLOW : Gate.DENY;
}

export function pruneWithBasicTokenAuthed(auth: PathnameViewerRules, node: RootNode, roles: string[] = []): RootNode {
    const result = Pruner.from(node)
        // apply rbac
        .keep(withAllowed(rbacViewGate(roles, true)))
        // hide nodes that are not authed
        .hide((n) => n.hidden || auth.anonymous?.find((path) => matchPath(path, slugToHref(n.slug))) != null)
        // mark all nodes as unauthed since we are currently authenticated
        .authed(() => false)
        .get();

    // TODO: handle this more gracefully
    if (result == null) {
        throw new Error("Failed to prune navigation tree");
    }

    return result;
}

export function pruneWithAuthState(authState: AuthState, authConfig: PathnameViewerRules, node: RootNode): RootNode {
    return authState.authed
        ? pruneWithBasicTokenAuthed(authConfig, node, authState.user.roles)
        : pruneWithBasicTokenAnonymous(authConfig, node);
}

/**
 * @internal visibleForTesting
 * For password auth anonymous users: uses RBAC to determine which nodes require auth
 * Nodes with viewers that don't include "everyone" will be marked as authed
 */
function withPasswordAuthAnonymousCheck(): (
    node: Partial<NavigationNode>,
    parents?: readonly NavigationNodeParent[]
) => Gate {
    return (node, parents = EMPTY_ARRAY) => {
        const predicate = rbacViewGate([], false);
        return predicate(node as unknown as NavigationNode, parents);
    };
}

/**
 * For password auth: marks nodes as requiring auth based on RBAC (viewers)
 * Used when user is NOT authenticated with password auth
 * Nodes without viewers restrictions or with viewers: ["everyone"] will be accessible
 */
export function pruneWithPasswordAuthAnonymous(node: RootNode): RootNode {
    const result = Pruner.from(node)
        // mark nodes as authed based on RBAC (same logic as basic auth)
        .authed(withDenied(withPasswordAuthAnonymousCheck()))
        .get();

    if (result == null) {
        throw new Error("Failed to prune navigation tree for password auth");
    }

    return result;
}

/**
 * For password auth: applies RBAC filtering and marks all nodes as unauthed
 * Used when user IS authenticated with password auth
 */
export function pruneWithPasswordAuthAuthed(node: RootNode, roles: string[] = []): RootNode {
    const result = Pruner.from(node)
        // apply rbac - keep nodes that the user has access to
        .keep(withAllowed(rbacViewGate(roles, true)))
        // mark all nodes as unauthed since we are currently authenticated
        .authed(() => false)
        .get();

    if (result == null) {
        throw new Error("Failed to prune navigation tree for password auth");
    }

    return result;
}

/**
 * Prune navigation tree for password authentication
 * Similar to pruneWithAuthState but for password auth (no allowlist/denylist - everything requires auth)
 */
export function pruneWithPasswordAuth(authState: AuthState, node: RootNode): RootNode {
    return authState.authed
        ? pruneWithPasswordAuthAuthed(node, authState.user.roles)
        : pruneWithPasswordAuthAnonymous(node);
}

/**
 * @param nodes - navigation nodes to get the viewer filters for
 * @returns the viewer filters for the given nodes
 * @internal visibleForTesting
 */
export function getViewerFilters(...nodes: FernNavigation.WithPermissions[]): string[][] {
    // ignore permissions of parents of the parents of an orphaned node
    const lastOrphanedIdx = nodes.findLastIndex((n) => n.orphaned);
    return (
        nodes
            .slice(Math.max(lastOrphanedIdx, 0))
            // TODO: if we ever support editors, we need to update this
            .map((n) => n.viewers ?? [])
            .filter((roles) => roles.length > 0)
    );
}

function rbacViewGate(
    roles: string[],
    authed: boolean
): (node: NavigationNode, parents: readonly NavigationNodeParent[]) => Gate {
    return (node, parents) => {
        if (!hasMetadata(node)) {
            return Gate.ALLOW;
        }

        if (!authed && node.authed) {
            return Gate.DENY;
        }

        const nodes = [...parents, node];
        const filters = getViewerFilters(...nodes.filter(FernNavigation.hasMetadata));

        return matchRoles(authed ? roles : "anonymous", filters);
    };
}
