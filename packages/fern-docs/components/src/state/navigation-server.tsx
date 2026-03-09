import { FernNavigation } from "@fern-api/fdr-sdk";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";

/**
 * The state of the expanded nodes for a sidebar root node
 */
export interface ExpandedNodesState {
    expandedNodes: ReadonlySet<FernNavigation.NodeId>;
    implicitExpandedNodes: ReadonlySet<FernNavigation.NodeId>;
    collapsedNodes: ReadonlySet<FernNavigation.NodeId>;
    childToParentsMap: ReadonlyMap<FernNavigation.NodeId, FernNavigation.NodeId[]>;
}

/**
 * Create the initial expanded nodes for a sidebar root node
 * @param currentNodeId - The current node id
 * @param childToParentsMap - The child to parents map
 * @param initiallyCollapsedNodes - Nodes that should start collapsed (from collapsed: true in config)
 * @returns The initial expanded nodes state
 */
export function createInitialExpandedNodes(
    currentNodeId: FernNavigation.NodeId | undefined,
    childToParentsMap: ReadonlyMap<FernNavigation.NodeId, FernNavigation.NodeId[]>,
    initiallyCollapsedNodes?: ReadonlySet<FernNavigation.NodeId>
): ExpandedNodesState {
    const expandedNodes = new Set<FernNavigation.NodeId>();
    const implicitExpandedNodes = new Set<FernNavigation.NodeId>();
    const collapsedNodes = new Set<FernNavigation.NodeId>(initiallyCollapsedNodes);

    if (currentNodeId != null) {
        expandedNodes.add(currentNodeId);
        childToParentsMap.get(currentNodeId)?.forEach((parent) => {
            implicitExpandedNodes.add(parent);
            // If a parent is in the path to the current node, remove it from collapsed
            collapsedNodes.delete(parent);
        });
    }

    return {
        expandedNodes,
        implicitExpandedNodes,
        collapsedNodes,
        childToParentsMap
    };
}

export function getSidebarRootNodeIdToChildToParentsMap(
    sidebarRootNodes: ReadonlyMap<FernNavigation.NodeId, FernNavigation.SidebarRootNode>
): ReadonlyMap<FernNavigation.NodeId, ReadonlyMap<FernNavigation.NodeId, FernNavigation.NodeId[]>> {
    return new Map(
        Array.from(sidebarRootNodes.values()).map((sidebarRootNode) => {
            return [sidebarRootNode.id, getNavigationChildToParentsMap(sidebarRootNode)];
        })
    );
}
/**
 * Get all the sidebar root nodes in a root node
 * @param root - The root node
 * @returns The sidebar root nodes
 */
export function getAllSidebarRootNodes(
    root: FernNavigation.RootNode | undefined
): ReadonlyMap<FernNavigation.NodeId, FernNavigation.SidebarRootNode> {
    if (root == null) {
        return new Map();
    }
    const sidebarRootNodes = new Map<FernNavigation.NodeId, FernNavigation.SidebarRootNode>();
    FernNavigation.traverseBF(root, (node) => {
        if (node.type === "sidebarRoot") {
            sidebarRootNodes.set(node.id, node);
            return SKIP;
        }
        return CONTINUE;
    });
    return sidebarRootNodes;
}

/**
 * Get the child to parents map for a sidebar root node
 * @param sidebar - The sidebar root node
 * @returns The child to parents map
 */
export function getNavigationChildToParentsMap(
    sidebar: FernNavigation.SidebarRootNode | undefined
): ReadonlyMap<FernNavigation.NodeId, FernNavigation.NodeId[]> {
    const childToParentsMap = new Map<FernNavigation.NodeId, FernNavigation.NodeId[]>();
    if (sidebar == null) {
        return childToParentsMap;
    }

    FernNavigation.traverseDF(sidebar, (node, parents) => {
        childToParentsMap.set(
            node.id,
            parents.map((p) => p.id)
        );
    });

    return childToParentsMap;
}

/**
 * Invert a parent to child map
 * @param parentChildMap - The parent to child map
 * @returns The child to parent map
 */
export function invertParentChildMap(
    parentChildMap: ReadonlyMap<FernNavigation.NodeId, FernNavigation.NodeId[]>
): ReadonlyMap<FernNavigation.NodeId, FernNavigation.NodeId[]> {
    const invertedParentChildMap = new Map<FernNavigation.NodeId, FernNavigation.NodeId[]>();
    parentChildMap.forEach((children, parent) => {
        children.forEach((child) => {
            const parents = invertedParentChildMap.get(child) ?? [];
            parents.push(parent);
            invertedParentChildMap.set(child, parents);
        });
    });
    return invertedParentChildMap;
}

/**
 * Get all nodes that should be initially collapsed based on their `collapsed` property.
 * @param sidebar - The sidebar root node
 * @returns Set of node IDs that should start collapsed
 */
export function getInitiallyCollapsedNodes(
    sidebar: FernNavigation.SidebarRootNode | undefined
): ReadonlySet<FernNavigation.NodeId> {
    const collapsedNodes = new Set<FernNavigation.NodeId>();
    if (sidebar == null) {
        return collapsedNodes;
    }

    FernNavigation.traverseDF(sidebar, (node) => {
        if (node.collapsed === true) {
            collapsedNodes.add(node.id);
        }
    });

    return collapsedNodes;
}

// /**
//  * Create the initial expanded nodes for a sidebar root node
//  * @param currentNodeId - The current node id
//  * @param sidebarRootNodes - The sidebar root nodes
//  * @returns The initial expanded nodes state
//  */
// function createInitialExpandedNodesBySidebarRootId(
//   currentNodeId: FernNavigation.NodeId | undefined,
//   sidebarRootNodes: ReadonlyMap<
//     FernNavigation.NodeId,
//     FernNavigation.SidebarRootNode
//   >
// ): ReadonlyMap<FernNavigation.NodeId, ExpandedNodesState> {
//   return new Map(
//     Array.from(sidebarRootNodes.values()).map((sidebarRootNode) => {
//       return [
//         sidebarRootNode.id,
//         createInitialExpandedNodes(
//           currentNodeId,
//           getNavigationChildToParentsMap(sidebarRootNode)
//         ),
//       ];
//     })
//   );
// }
