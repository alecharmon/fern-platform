import { dfs } from "../../../utils/traversers/dfs";
import type { TraverserVisit } from "../../../utils/traversers/types";
import type { NavigationNode } from "./NavigationNode";
import { getChildren } from "./getChildren";

export function traverseDF(node: NavigationNode, visit: TraverserVisit<NavigationNode>): void {
    return dfs(node, visit, getChildren);
}
