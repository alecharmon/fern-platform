import type { NavigationNode, VariantedNode } from ".";

export function isVariantedNode(node: NavigationNode | undefined): node is VariantedNode {
    return node?.type === "varianted";
}
