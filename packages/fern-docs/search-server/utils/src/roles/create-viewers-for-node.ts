import { FernNavigation } from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";

import { flipAndOrToOrAnd, modifyRolesForEveryone } from "./role-utils";

/**
 * @param nodes - the parents and the node itself
 * @param authed - whether the docs site has auth enabled. If false, we assume the default case that all records should be visible to everyone.
 * @returns a OR list of AND'd roles, or [[EVERYONE_ROLE]] if the list is empty AND the docs site does not have auth enabled.
 */
export function createViewersForNodes(
  nodes: readonly FernNavigation.NavigationNode[],
  authed: boolean
): {
  roles: string[][];
  authed: boolean;
} {
  let nodesWithMetadata = nodes.filter(FernNavigation.hasMetadata);
  const lastOrphanedIdx = nodesWithMetadata.findLastIndex((n) => n.orphaned);
  if (lastOrphanedIdx >= 0) {
    nodesWithMetadata = nodesWithMetadata.slice(lastOrphanedIdx);
  }
  const viewersHierarchy = nodesWithMetadata
    .map((node) => node.viewers)
    .filter(isNonNullish)
    .filter((viewers) => viewers.length > 0);

  const requiredRoles = flipAndOrToOrAnd(viewersHierarchy);

  return modifyRolesForEveryone(requiredRoles, authed);
}
