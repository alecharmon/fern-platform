import { dfs } from "../../../utils/traversers/dfs";
import type { TraverserVisit } from "../../../utils/traversers/types";
import { getChildren } from "./getChildren";
import type { NavigationNode } from "./NavigationNode";

export function traverseDF(node: NavigationNode, visit: TraverserVisit<NavigationNode>): void {
    return dfs(node, visit, getChildren);
}
