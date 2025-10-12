import { bfs } from "../../../utils/traversers/bfs";
import type { TraverserVisit } from "../../../utils/traversers/types";
import { getChildren } from "./getChildren";
import type { NavigationNode } from "./NavigationNode";
import type { NavigationNodeParent } from "./NavigationNodeParent";

const SKIP = "skip" as const;

/**
 * Traverse the navigation tree in a depth-first manner (pre-order).
 */
export function traverseBF(node: NavigationNode, visit: TraverserVisit<NavigationNode, NavigationNodeParent>) {
    return bfs(node, visit, getChildren);
}
