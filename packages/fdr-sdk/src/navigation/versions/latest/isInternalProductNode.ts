import type { InternalProductNode, NavigationNode } from ".";

export function isInternalProductNode(node: NavigationNode): node is InternalProductNode {
    return node.type === "product";
}
