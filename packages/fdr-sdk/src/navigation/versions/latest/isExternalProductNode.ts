import type { ExternalProductNode, NavigationNode } from ".";

export function isExternalProductNode(node: NavigationNode): node is ExternalProductNode {
    return node.type === "productLink";
}
