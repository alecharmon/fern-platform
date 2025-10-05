import type { NavigationNode } from "./NavigationNode";
import type { NavigationNodeLeaf } from "./NavigationNodeLeaf";

export type NavigationNodeParent = Exclude<NavigationNode, NavigationNodeLeaf>;
