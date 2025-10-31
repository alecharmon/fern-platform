import type { NavigationNode, VariantNode } from ".";

export function isVariantNode(node: NavigationNode | undefined): node is VariantNode {
    return node?.type === "variant";
}
