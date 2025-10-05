import { dfs } from "../../../utils/traversers/dfs";
import type { TraverserVisit } from "../../../utils/traversers/types";
import type { NavigationNode } from "./NavigationNode";
import type { NavigationNodeParent } from "./NavigationNodeParent";
import { getChildren } from "./getChildren";

/**
 * Traverse the navigation tree in a depth-first manner (pre-order).
 */
export function traverseDF(node: NavigationNode, visit: TraverserVisit<NavigationNode, NavigationNodeParent>): void {
    return dfs(node, visit, getChildren);
}
