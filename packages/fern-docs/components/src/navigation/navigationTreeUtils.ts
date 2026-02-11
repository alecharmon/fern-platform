import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getChildren } from "@fern-api/fdr-sdk/navigation";

/** Result of finding a section node in the navigation tree */
export interface SectionSearchResult {
    section: FernNavigation.SectionNode;
    /** The tab slug if the section is nested within a tab */
    tabSlug?: string;
    /** The product node if the section is within a product */
    product?: FernNavigation.ProductNode;
    /** The version node if the section is within a version */
    version?: FernNavigation.VersionNode;
}

/** Result of finding a sidebarGroup node in the navigation tree */
export interface SidebarGroupSearchResult {
    container: FernNavigation.SectionNode | FernNavigation.SidebarGroupNode;
    /** The tab slug if the container is nested within a tab */
    tabSlug?: string;
    /** The product node if the container is within a product */
    product?: FernNavigation.ProductNode;
    /** The version node if the container is within a version */
    version?: FernNavigation.VersionNode;
}

/** Result of finding a container node (section or sidebarGroup) in the navigation tree */
export type ContainerSearchResult = SectionSearchResult | SidebarGroupSearchResult;

/** Result of finding a page node in the navigation tree */
export interface PageSearchResult {
    page: FernNavigation.PageNode;
    /** The tab slug if the page is nested within a tab */
    tabSlug?: string;
    /** The product node if the page is within a product */
    product?: FernNavigation.ProductNode;
    /** The version node if the page is within a version */
    version?: FernNavigation.VersionNode;
}

/** Finds a section node by ID in the navigation tree and returns it with context */
export function findSectionById(
    rootNode: FernNavigation.NavigationNode,
    sectionId: FernNavigation.NodeId,
    currentTab?: string
): SectionSearchResult | undefined {
    let result: SectionSearchResult | undefined;

    const traverse = (
        node: FernNavigation.NavigationNode,
        tab?: string,
        product?: FernNavigation.ProductNode,
        version?: FernNavigation.VersionNode
    ): boolean => {
        if (!node) {
            console.error("[findSectionById] Encountered undefined node during traversal", {
                sectionId,
                tab,
                hasProduct: !!product,
                hasVersion: !!version
            });
            return false;
        }

        if (node.type === "section" && node.id === sectionId) {
            result = { section: node, tabSlug: tab, product, version };
            return true;
        }

        // Handle node types with single child property
        if (node.type === "root" || node.type === "unversioned") {
            const child = node.child;
            if (!child) {
                console.error("[findSectionById] Node has no child property", {
                    nodeType: node.type,
                    sectionId
                });
                return false;
            }
            return traverse(child, tab, product, version);
        }

        // Handle versioned node - it has multiple version children
        if (node.type === "versioned") {
            const children = node.children;
            if (!children || !Array.isArray(children)) {
                console.error("[navigationTreeUtils] Versioned node has no children array", {
                    versionNode: node
                });
                return false;
            }
            // Traverse each version node
            for (const versionNode of children) {
                if (versionNode && versionNode.type === "version") {
                    // Each version node has a child property
                    if (traverse(versionNode.child, tab, product, versionNode)) {
                        return true;
                    }
                }
            }
            return false;
        }

        // Handle product node - track the product
        if (node.type === "product") {
            const child = node.child;
            if (!child) {
                console.error("[findSectionById] Product node has no child", {
                    productNode: node,
                    sectionId
                });
                return false;
            }
            return traverse(child, tab, node, version);
        }

        // Handle tabbed nodes - they have children array
        if (node.type === "tabbed") {
            const children = node.children;
            if (!children) {
                console.error("[findSectionById] Tabbed node has no children array", {
                    sectionId
                });
                return false;
            }
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (!child) {
                    console.error("[findSectionById] Undefined child in tabbed.children", {
                        childIndex: i,
                        sectionId
                    });
                    continue;
                }
                if (traverse(child, tab, product, version)) {
                    return true;
                }
            }
            return false;
        }

        // Handle node types with children array
        if (
            node.type === "sidebarRoot" ||
            node.type === "sidebarGroup" ||
            node.type === "section" ||
            node.type === "productgroup"
        ) {
            if (!node.children) {
                console.error("[findSectionById] Node has no children array", {
                    nodeType: node.type,
                    nodeId: node.id,
                    sectionId
                });
                return false;
            }
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                if (!child) {
                    console.error("[findSectionById] Undefined child in children array", {
                        nodeType: node.type,
                        nodeId: node.id,
                        childIndex: i,
                        sectionId
                    });
                    continue;
                }
                if (traverse(child, tab, product, version)) {
                    return true;
                }
            }
        }

        // Handle tab node specially - track the tab slug
        if (node.type === "tab") {
            if (!node.child) {
                console.error("[navigationTreeUtils] Tab node has no child", {
                    tabSlug: node.slug,
                    tab: node
                });
                return false;
            }
            return traverse(node.child, node.slug, product, version);
        }

        return false;
    };

    traverse(rootNode, currentTab);
    return result;
}

/** Finds a section title by ID in the navigation tree */
export function findSectionTitleById(
    rootNode: FernNavigation.NavigationNode,
    sectionId: FernNavigation.NodeId
): string | null {
    const result = findSectionById(rootNode, sectionId);
    return result?.section.title ?? null;
}

/**
 * Returns the titles of all ancestor section nodes between the sidebar root and the given node.
 * Does NOT include the target node itself.
 * Used to build `parentSectionPathTitles` for YAML section-path navigation.
 *
 * Example: for tree  sidebarRoot > sectionA > sectionB > targetSection
 *   getSectionAncestorTitles(root, targetSection.id) → ["sectionA title", "sectionB title"]
 */
export function getSectionAncestorTitles(
    rootNode: FernNavigation.NavigationNode,
    nodeId: FernNavigation.NodeId
): string[] {
    const path: string[] = [];
    let found = false;

    const traverse = (node: FernNavigation.NavigationNode, ancestors: string[]): boolean => {
        if (!node) {
            return false;
        }

        if (node.id === nodeId) {
            path.push(...ancestors);
            found = true;
            return true;
        }

        const nextAncestors = node.type === "section" ? [...ancestors, node.title] : ancestors;
        for (const child of getChildren(node)) {
            if (traverse(child, nextAncestors)) {
                return true;
            }
        }
        return false;
    };

    traverse(rootNode, []);
    return found ? path : [];
}

/**
 * Checks whether `descendantId` is a descendant of the subtree rooted at `ancestorId`.
 * Returns true if `descendantId` is found anywhere inside the subtree of `ancestorId`.
 * Returns false if `ancestorId` === `descendantId` (a node is not its own descendant).
 */
export function isDescendantOf(
    rootNode: FernNavigation.NavigationNode,
    ancestorId: FernNavigation.NodeId,
    descendantId: FernNavigation.NodeId
): boolean {
    // First, locate the ancestor node in the tree
    const ancestorNode = findNodeById(rootNode, ancestorId);
    if (!ancestorNode) {
        return false;
    }

    // Search within the ancestor's subtree (excluding the ancestor itself)
    const searchSubtree = (node: FernNavigation.NavigationNode): boolean => {
        for (const child of getChildren(node)) {
            if (child.id === descendantId) {
                return true;
            }
            if (searchSubtree(child)) {
                return true;
            }
        }
        return false;
    };

    return searchSubtree(ancestorNode);
}

/**
 * Finds the tab slug that contains the given node.
 * Returns undefined if the node is not inside any tab, or if the node is not found.
 */
export function findNodeTabSlug(
    rootNode: FernNavigation.NavigationNode,
    nodeId: FernNavigation.NodeId
): string | undefined {
    let result: string | undefined;

    const traverse = (node: FernNavigation.NavigationNode, currentTabSlug?: string): boolean => {
        if (!node) {
            return false;
        }
        if (node.id === nodeId) {
            result = currentTabSlug;
            return true;
        }

        const tabSlug = node.type === "tab" ? node.slug : currentTabSlug;
        for (const child of getChildren(node)) {
            if (traverse(child, tabSlug)) {
                return true;
            }
        }
        return false;
    };

    traverse(rootNode);
    return result;
}

/** Finds a container node (section or sidebarGroup) by ID in the navigation tree */
function _findContainerById(
    rootNode: FernNavigation.NavigationNode,
    containerId: FernNavigation.NodeId,
    currentTab?: string
): ContainerSearchResult | undefined {
    let result: ContainerSearchResult | undefined;

    const traverse = (
        node: FernNavigation.NavigationNode,
        tab?: string,
        product?: FernNavigation.ProductNode,
        version?: FernNavigation.VersionNode
    ): boolean => {
        if (!node) {
            return false;
        }

        // Check if this node is the container we're looking for
        if ((node.type === "section" || node.type === "sidebarGroup") && node.id === containerId) {
            result = {
                container: node as FernNavigation.SectionNode | FernNavigation.SidebarGroupNode,
                tabSlug: tab,
                product,
                version
            };
            return true;
        }

        // Handle node types with single child property
        if (node.type === "root" || node.type === "unversioned") {
            const child = node.child;
            if (child && traverse(child, tab, product, version)) {
                return true;
            }
        }

        // Handle product nodes
        if (node.type === "product") {
            const child = node.child;
            if (child && traverse(child, tab, node, version)) {
                return true;
            }
        }

        // Handle versioned nodes
        if (node.type === "versioned") {
            for (const versionNode of node.children || []) {
                if (traverse(versionNode, tab, product, version)) {
                    return true;
                }
            }
        }

        // Handle version nodes
        if (node.type === "version") {
            const child = node.child;
            if (child && traverse(child, tab, product, node)) {
                return true;
            }
        }

        // Handle tabbed nodes
        if (node.type === "tabbed") {
            for (const tabNode of node.children || []) {
                if (tabNode.type === "tab") {
                    const tabSlug = tabNode.slug;
                    if (!currentTab || currentTab === tabSlug) {
                        if (traverse(tabNode.child, tabSlug, product, version)) {
                            return true;
                        }
                    }
                }
            }
        }

        // Handle nodes with children arrays
        if (
            node.type === "sidebarRoot" ||
            node.type === "sidebarGroup" ||
            node.type === "section" ||
            node.type === "apiPackage" ||
            node.type === "apiReference"
        ) {
            for (const child of node.children || []) {
                if (traverse(child, tab, product, version)) {
                    return true;
                }
            }
        }

        return false;
    };

    traverse(rootNode);
    return result;
}

/** Finds a page node by pageId in the navigation tree and returns it with context */
export function findPageByPageId(
    rootNode: FernNavigation.NavigationNode,
    pageId: FernNavigation.PageId
): PageSearchResult | undefined {
    let result: PageSearchResult | undefined;

    const traverse = (
        node: FernNavigation.NavigationNode,
        tab?: string,
        product?: FernNavigation.ProductNode,
        version?: FernNavigation.VersionNode
    ): boolean => {
        if (!node) {
            console.error("[findPageByPageId] Encountered undefined node during traversal", {
                pageId,
                tab,
                hasProduct: !!product,
                hasVersion: !!version
            });
            return false;
        }

        if (node.type === "page" && node.pageId === pageId) {
            result = { page: node, tabSlug: tab, product, version };
            return true;
        }

        // Handle node types with single child property
        if (node.type === "root" || node.type === "unversioned") {
            const child = node.child;
            if (!child) {
                console.error("[findPageByPageId] Node has no child property", {
                    nodeType: node.type,
                    pageId
                });
                return false;
            }
            return traverse(child, tab, product, version);
        }

        // Handle versioned node - it has multiple version children
        if (node.type === "versioned") {
            const children = node.children;
            if (!children || !Array.isArray(children)) {
                console.error("[findPageByPageId] Versioned node has no children array", {
                    versionNode: node,
                    pageId
                });
                return false;
            }
            // Traverse each version node
            for (const versionNode of children) {
                if (versionNode && versionNode.type === "version") {
                    // Each version node has a child property
                    if (traverse(versionNode.child, tab, product, versionNode)) {
                        return true;
                    }
                }
            }
            return false;
        }

        // Handle product node - track the product
        if (node.type === "product") {
            const child = node.child;
            if (!child) {
                console.error("[findPageByPageId] Product node has no child", {
                    productNode: node,
                    pageId
                });
                return false;
            }
            return traverse(child, tab, node, version);
        }

        // Handle tabbed nodes - they have children array
        if (node.type === "tabbed") {
            for (const child of node.children) {
                if (traverse(child, tab, product, version)) {
                    return true;
                }
            }
            return false;
        }

        // Handle node types with children array
        if (
            node.type === "sidebarRoot" ||
            node.type === "sidebarGroup" ||
            node.type === "section" ||
            node.type === "productgroup" ||
            node.type === "apiPackage"
        ) {
            for (const child of node.children) {
                if (traverse(child, tab, product, version)) {
                    return true;
                }
            }
        }

        // Handle tab node specially - track the tab slug
        if (node.type === "tab") {
            if (!node.child) {
                console.error("[navigationTreeUtils] Tab node has no child", {
                    tabSlug: node.slug,
                    tab: node
                });
                return false;
            }
            return traverse(node.child, node.slug, product, version);
        }

        return false;
    };

    traverse(rootNode);
    return result;
}

/** Finds a page node by its NodeId (node.id) in the navigation tree and returns it with context */
export function findPageByNodeId(
    rootNode: FernNavigation.NavigationNode,
    nodeId: FernNavigation.NodeId
): PageSearchResult | undefined {
    let result: PageSearchResult | undefined;

    const traverse = (
        node: FernNavigation.NavigationNode,
        tab?: string,
        product?: FernNavigation.ProductNode,
        version?: FernNavigation.VersionNode
    ): boolean => {
        if (!node) {
            return false;
        }

        if (node.type === "page" && node.id === nodeId) {
            result = { page: node, tabSlug: tab, product, version };
            return true;
        }

        // Update context for children
        const nextTab = node.type === "tab" ? node.slug : tab;
        const nextProduct = node.type === "product" ? (node as FernNavigation.ProductNode) : product;
        const nextVersion = node.type === "version" ? (node as FernNavigation.VersionNode) : version;

        for (const child of getChildren(node)) {
            if (traverse(child, nextTab, nextProduct, nextVersion)) {
                return true;
            }
        }
        return false;
    };

    traverse(rootNode);
    return result;
}

/** Updates a section title in the navigation tree immutably */
export function updateSectionTitle(
    rootNode: FernNavigation.RootNode,
    sectionId: FernNavigation.NodeId,
    newTitle: string
): FernNavigation.RootNode {
    const updateNode = <T extends FernNavigation.NavigationNode>(node: T): T => {
        // Check if this is the section we want to rename
        if (node.type === "section" && node.id === sectionId) {
            return { ...node, title: newTitle } as T;
        }

        // Recursively update children based on node type
        switch (node.type) {
            case "root":
                return { ...node, child: updateNode(node.child) } as T;
            case "unversioned":
                return { ...node, child: updateNode(node.child) } as T;
            case "product":
                return { ...node, child: updateNode((node as any).child) } as T;
            case "versioned": {
                // Versioned node has children array of version nodes
                const versionedNode = node as any;
                if (versionedNode.children && Array.isArray(versionedNode.children)) {
                    return {
                        ...node,
                        children: versionedNode.children.map((child: any) => updateNode(child))
                    } as T;
                }
                return node;
            }
            case "version":
                return { ...node, child: updateNode((node as any).child) } as T;
            case "tabbed": {
                const tabbedNode = node as any;
                if (tabbedNode.tabs && Array.isArray(tabbedNode.tabs)) {
                    return {
                        ...node,
                        tabs: tabbedNode.tabs.map((tab: any) => updateNode(tab))
                    } as T;
                } else if (tabbedNode.children && Array.isArray(tabbedNode.children)) {
                    return {
                        ...node,
                        children: tabbedNode.children.map((child: any) => updateNode(child))
                    } as T;
                } else {
                    return node;
                }
            }
            case "productgroup":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "sidebarRoot":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "sidebarGroup":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "section":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "tab":
                return { ...node, child: updateNode(node.child) } as T;
            case "apiPackage":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            default:
                return node;
        }
    };

    return updateNode(rootNode);
}

/** Updates a page title in the navigation tree immutably */
export function updatePageTitle(
    rootNode: FernNavigation.RootNode,
    pageId: FernNavigation.PageId,
    newTitle: string
): FernNavigation.RootNode {
    const updateNode = <T extends FernNavigation.NavigationNode>(node: T): T => {
        if (node.type === "page" && node.pageId === pageId) {
            return { ...node, title: newTitle } as T;
        }

        switch (node.type) {
            case "root":
                return { ...node, child: updateNode(node.child) } as T;
            case "unversioned":
                return { ...node, child: updateNode(node.child) } as T;
            case "product":
                return { ...node, child: updateNode((node as any).child) } as T;
            case "versioned": {
                const versionedNode = node as any;
                if (versionedNode.children && Array.isArray(versionedNode.children)) {
                    return {
                        ...node,
                        children: versionedNode.children.map((child: any) => updateNode(child))
                    } as T;
                }
                return node;
            }
            case "version":
                return { ...node, child: updateNode((node as any).child) } as T;
            case "tabbed": {
                const tabbedNode = node as any;
                if (tabbedNode.tabs && Array.isArray(tabbedNode.tabs)) {
                    return {
                        ...node,
                        tabs: tabbedNode.tabs.map((tab: any) => updateNode(tab))
                    } as T;
                } else if (tabbedNode.children && Array.isArray(tabbedNode.children)) {
                    return {
                        ...node,
                        children: tabbedNode.children.map((child: any) => updateNode(child))
                    } as T;
                } else {
                    return node;
                }
            }
            case "productgroup":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "sidebarRoot":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "sidebarGroup":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "section":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            case "tab":
                return { ...node, child: updateNode(node.child) } as T;
            case "apiPackage":
                return {
                    ...node,
                    children: node.children.map((child) => updateNode(child))
                } as T;
            default:
                return node;
        }
    };

    return updateNode(rootNode);
}

/**
 * Finds an existing section by title within a parent container.
 * Used to check for duplicate sections before creating a new one.
 *
 * @param rootNode - The root node to search in
 * @param parentContainerId - The ID of the parent container
 * @param sectionTitle - The title of the section to find
 * @returns The section node if found, undefined otherwise
 */
export function findSectionByTitleInContainer(
    rootNode: FernNavigation.RootNode,
    parentContainerId: FernNavigation.NodeId,
    sectionTitle: string
): FernNavigation.SectionNode | undefined {
    const containerResult = _findContainerById(rootNode, parentContainerId);
    if (!containerResult) {
        return undefined;
    }

    const containerNode = "container" in containerResult ? containerResult.container : containerResult.section;
    const children = containerNode.children;

    const matchingSection = children.find(
        (child): child is FernNavigation.SectionNode => child.type === "section" && child.title === sectionTitle
    );

    return matchingSection;
}

/**
 * Counts how many times a specific page appears in a list of children.
 * Used when calculating insertion indices to account for pages that should be excluded.
 *
 * @param children - Array of navigation nodes to search
 * @param pageId - The page ID to count
 * @returns Number of occurrences of the page in children
 */
function _countPagesWithId(children: FernNavigation.NavigationNode[], pageId: FernNavigation.PageId): number {
    return children.filter((child) => child.type === "page" && (child as FernNavigation.PageNode).pageId === pageId)
        .length;
}

/**
 * Finds the sidebarRoot that contains a given sidebarGroup by ID.
 * This is needed to understand the sibling context of the sidebarGroup.
 *
 * @param node - The navigation node to search from
 * @param sidebarGroupId - The ID of the sidebarGroup to find
 * @returns The sidebarRoot containing the sidebarGroup, or undefined if not found
 */
function _findSidebarRootContaining(
    node: FernNavigation.NavigationNode,
    sidebarGroupId: FernNavigation.NodeId
): FernNavigation.SidebarRootNode | undefined {
    // Handle root wrapper
    if (node.type === "root" && node.child) {
        return _findSidebarRootContaining(node.child, sidebarGroupId);
    }

    // Handle unversioned wrapper
    if (node.type === "unversioned" && node.child) {
        return _findSidebarRootContaining(node.child, sidebarGroupId);
    }

    // Handle product wrapper
    if (node.type === "product" && node.child) {
        return _findSidebarRootContaining(node.child, sidebarGroupId);
    }

    // Handle version wrapper
    if (node.type === "version" && node.child) {
        return _findSidebarRootContaining(node.child, sidebarGroupId);
    }

    // Handle versioned (search through all versions)
    if (node.type === "versioned" && node.children) {
        for (const versionNode of node.children) {
            const result = _findSidebarRootContaining(versionNode, sidebarGroupId);
            if (result) {
                return result;
            }
        }
    }

    // Handle tabbed (search through all tabs)
    if (node.type === "tabbed" && node.children) {
        for (const tabNode of node.children) {
            if (tabNode.type === "tab" && tabNode.child) {
                const result = _findSidebarRootContaining(tabNode.child, sidebarGroupId);
                if (result) {
                    return result;
                }
            }
        }
    }

    // Handle sidebarRoot - check if it contains the target sidebarGroup
    if (node.type === "sidebarRoot" && node.children) {
        const hasSidebarGroup = node.children.some(
            (child: any) => child.type === "sidebarGroup" && child.id === sidebarGroupId
        );
        if (hasSidebarGroup) {
            return node;
        }
    }

    return undefined;
}

/**
 * Calculates the insertion index for a new page within a container (section or sidebarGroup).
 *
 * Insertion behavior:
 * - For sidebarGroups (root-level): Pages are appended to end of the sidebarGroup's children
 *   Note: sidebarGroups are unwrapped in YAML, so we need to find the parent context
 * - For sections: Pages are appended to the end
 *
 * Note: sidebarRoot targets should use {@link computeSidebarRootFlatIndex} directly.
 *
 * @param treeNode - The RootNode or SidebarRootNode to search in
 * @param containerId - The ID of the container (section or sidebarGroup) to insert into
 * @param excludePageId - Optional page ID to exclude from counting (used when unmarking deletion)
 * @returns The calculated insertion index, or undefined if container not found
 */
export function calculateInsertionIndex(
    treeNode: FernNavigation.RootNode | FernNavigation.SidebarRootNode | undefined,
    containerId: FernNavigation.NodeId,
    excludePageId?: FernNavigation.PageId
): number | undefined {
    if (!treeNode) {
        return undefined;
    }

    // Find the container (section or sidebarGroup)
    const containerResult = _findContainerById(treeNode, containerId);
    if (!containerResult) {
        return undefined;
    }

    // Extract the actual container node from the result (handles both SectionSearchResult and SidebarGroupSearchResult)
    const containerNode = "container" in containerResult ? containerResult.container : containerResult.section;
    const children = containerNode.children;

    // For sidebarGroups (root-level containers), we need to calculate the index in the parent context
    // because sidebarGroups are unwrapped in YAML
    if (containerNode.type === "sidebarGroup") {
        // Find the parent context (sidebarRoot) to see siblings
        const parentContext = _findSidebarRootContaining(treeNode, containerId);
        if (parentContext) {
            const siblings = parentContext.children;

            // Find the sidebarGroup in siblings
            const sidebarGroupIndex = siblings.findIndex((s: any) => s.type === "sidebarGroup" && s.id === containerId);
            if (sidebarGroupIndex >= 0) {
                // Count all children in the sidebarGroup (these will be unwrapped)
                // This includes pages, apiReferences, sections, etc.
                const childCount = children.length;

                // Adjust for excluded page if needed
                const adjustment = excludePageId ? _countPagesWithId(children, excludePageId) : 0;

                return childCount - adjustment;
            }
        }

        // Fallback: append to end of container
        if (excludePageId) {
            return children.filter(
                (child: any) => !(child.type === "page" && (child as FernNavigation.PageNode).pageId === excludePageId)
            ).length;
        }

        return children.length;
    }

    // For sections and other containers, append to the end
    if (excludePageId) {
        return children.filter(
            (child: any) => !(child.type === "page" && (child as FernNavigation.PageNode).pageId === excludePageId)
        ).length;
    }

    return children.length;
}

/**
 * Extracts the parent section ID from a found node's parents array.
 *
 * @param foundNode - The found node containing parents
 * @returns The ID of the closest section parent, or undefined if not found
 */
export function extractParentSectionId(foundNode: {
    parents: readonly FernNavigation.NavigationNode[];
}): FernNavigation.NodeId | undefined {
    // Find the closest section parent in the parents array
    const sectionParent = foundNode.parents
        .slice()
        .reverse()
        .find((parent) => parent.type === "section");
    return sectionParent?.id;
}

/**
 * Immutable reconstruction helper: applies an updater function to all children of a node.
 * Handles both single-child nodes (root, unversioned, product, version, tab) and
 * multi-child nodes (section, sidebarRoot, sidebarGroup, etc.).
 */
function _updateChildren<T extends FernNavigation.NavigationNode>(
    node: T,
    updater: <U extends FernNavigation.NavigationNode>(child: U) => U
): T {
    switch (node.type) {
        case "root":
        case "unversioned":
        case "tab":
            return { ...node, child: updater(node.child) } as T;
        case "product":
        case "version":
            return { ...node, child: updater((node as any).child) } as T;
        default:
            // For nodes with `children` arrays, map over them
            if ("children" in node && Array.isArray(node.children)) {
                return {
                    ...node,
                    children: node.children.map((child: any) => updater(child))
                } as T;
            }
            return node;
    }
}

/** Result of removing a node from the tree */
export interface RemoveNodeResult {
    /** The updated root node with the target removed */
    updatedRoot: FernNavigation.RootNode;
    /** The removed node */
    removedNode: FernNavigation.NavigationNode;
    /** The ID of the parent that contained the removed node */
    parentId: FernNavigation.NodeId;
}

/**
 * Removes a node by ID from the navigation tree immutably.
 * Only removes from nodes that have a `children` array (section, sidebarGroup, sidebarRoot, etc.).
 *
 * @param rootNode - The root node of the navigation tree
 * @param nodeId - The ID of the node to remove
 * @returns The updated tree, the removed node, and its parent ID; or undefined if not found
 */
export function removeNodeById(
    rootNode: FernNavigation.RootNode,
    nodeId: FernNavigation.NodeId
): RemoveNodeResult | undefined {
    let removedNode: FernNavigation.NavigationNode | undefined;
    let parentId: FernNavigation.NodeId | undefined;

    const removeFromNode = <T extends FernNavigation.NavigationNode>(node: T): T => {
        if (removedNode) {
            return node;
        }

        // For nodes with a `children` array, check if a direct child matches
        if ("children" in node && Array.isArray(node.children)) {
            const idx = node.children.findIndex((c: FernNavigation.NavigationNode) => c.id === nodeId);
            if (idx >= 0) {
                removedNode = node.children[idx];
                parentId = node.id;
                const children = [...node.children];
                children.splice(idx, 1);
                return { ...node, children } as T;
            }
        }

        // Recursively update children using immutable reconstruction
        return _updateChildren(node, removeFromNode);
    };

    const updatedRoot = removeFromNode(rootNode);

    if (!removedNode || !parentId) {
        return undefined;
    }

    return { updatedRoot, removedNode, parentId };
}

/**
 * Finds the parent node ID for a given node in the tree.
 *
 * @param rootNode - The root of the navigation tree
 * @param nodeId - The ID of the node to find the parent of
 * @returns The parent node ID, or undefined if not found
 */
export function findParentNodeId(
    rootNode: FernNavigation.NavigationNode,
    nodeId: FernNavigation.NodeId
): FernNavigation.NodeId | undefined {
    let result: FernNavigation.NodeId | undefined;

    const traverse = (node: FernNavigation.NavigationNode): boolean => {
        if (!node) {
            return false;
        }
        for (const child of getChildren(node)) {
            if (child.id === nodeId) {
                result = node.id;
                return true;
            }
            if (traverse(child)) {
                return true;
            }
        }
        return false;
    };

    traverse(rootNode);
    return result;
}

/**
 * Inserts a navigation node into a target parent at a specific index.
 * Works for any node type (page, section, etc.) being inserted into any container.
 *
 * @param rootNode - The root of the navigation tree
 * @param nodeToInsert - The node to insert
 * @param targetParentId - The ID of the parent to insert into
 * @param insertionIndex - The index at which to insert
 * @returns The updated root node
 */
export function insertNodeIntoParent(
    rootNode: FernNavigation.RootNode,
    nodeToInsert: FernNavigation.NavigationNode,
    targetParentId: FernNavigation.NodeId,
    insertionIndex: number,
    insertionMode: "atIndex" | "prepend" | "append" = "atIndex"
): FernNavigation.RootNode {
    let inserted = false;

    const insertInNode = <T extends FernNavigation.NavigationNode>(node: T): T => {
        if (inserted) {
            return node;
        }

        // If this is the target parent, insert the node
        if (
            (node.type === "section" || node.type === "sidebarGroup" || node.type === "sidebarRoot") &&
            node.id === targetParentId
        ) {
            inserted = true;
            const children = [...(node as any).children];

            // Determine insertion position based on mode
            let position: number;
            if (insertionMode === "prepend") {
                position = 0;
            } else if (insertionMode === "append") {
                position = children.length;
            } else {
                position = Math.min(Math.max(insertionIndex, 0), children.length);
            }

            // Pages/links/changelogs can't be direct sidebarRoot children — wrap in a SidebarGroupNode.
            // Valid direct children of sidebarRoot are: sidebarGroup, section, apiReference, varianted.
            const VALID_SIDEBAR_ROOT_CHILD_TYPES = new Set(["sidebarGroup", "section", "apiReference", "varianted"]);
            if (node.type === "sidebarRoot" && !VALID_SIDEBAR_ROOT_CHILD_TYPES.has(nodeToInsert.type)) {
                const wrapper: FernNavigation.SidebarGroupNode = {
                    type: "sidebarGroup",
                    id: FernNavigation.NodeId(
                        `${node.id}:sidebarGroup:dnd-${Math.random().toString(36).substring(2, 15)}`
                    ),
                    children: [nodeToInsert as FernNavigation.NavigationChild]
                };
                children.splice(position, 0, wrapper);
            } else {
                children.splice(position, 0, nodeToInsert);
            }
            return { ...node, children } as T;
        }

        // Recursively search children
        return _updateChildren(node, insertInNode);
    };

    return insertInNode(rootNode);
}

/**
 * Moves a node from its current position to a new parent at a specific index.
 * Composes removeNodeById + insertNodeIntoParent.
 *
 * When moving within the same parent, the insertion index is adjusted to account
 * for the removal of the node from its original position.
 *
 * @param rootNode - The root of the navigation tree
 * @param nodeId - The ID of the node to move
 * @param targetParentId - The ID of the parent to move the node into
 * @param insertionIndex - The index at which to insert in the target parent
 * @returns The updated root and context, or undefined if the node was not found
 */
export function moveNodeInTree(
    rootNode: FernNavigation.RootNode,
    nodeId: FernNavigation.NodeId,
    targetParentId: FernNavigation.NodeId,
    insertionIndex: number
): RemoveNodeResult | undefined {
    const removeResult = removeNodeById(rootNode, nodeId);
    if (!removeResult) {
        console.warn(`[moveNodeInTree] Cannot move node: nodeId ${String(nodeId)} not found`);
        return undefined;
    }

    const { updatedRoot, removedNode, parentId: fromParentId } = removeResult;

    // Defensive guard: after removing the node (and its subtree), verify the target parent
    // still exists in the tree. This prevents corruption when dropping a section into its own descendant.
    if (fromParentId !== targetParentId) {
        const targetExists = getChildrenOfNode(updatedRoot, targetParentId);
        if (targetExists === undefined) {
            console.warn(
                `[moveNodeInTree] Target parent ${String(targetParentId)} not reachable after removing ${String(nodeId)}. ` +
                    `This typically means the target was inside the removed subtree.`
            );
            return undefined;
        }
    }

    // If moving within the same parent, adjust the index since removal shifted children
    let adjustedIndex = insertionIndex;
    if (fromParentId === targetParentId) {
        // Find where the node was in the original parent to adjust the index
        const originalParentChildren = getChildrenOfNode(rootNode, fromParentId);
        if (originalParentChildren) {
            const originalIndex = originalParentChildren.findIndex((c) => c.id === nodeId);
            if (originalIndex >= 0 && originalIndex < insertionIndex) {
                adjustedIndex = insertionIndex - 1;
            }
        }
    }

    const finalRoot = insertNodeIntoParent(updatedRoot, removedNode, targetParentId, adjustedIndex);

    return {
        updatedRoot: finalRoot,
        removedNode,
        parentId: fromParentId
    };
}

/**
 * Gets the direct children array of a container node by its ID.
 * Only returns children for container-like nodes (section, sidebarGroup, sidebarRoot, etc.).
 * Used by moveNodeInTree to compute index adjustments.
 */
export function getChildrenOfNode(
    rootNode: FernNavigation.NavigationNode,
    nodeId: FernNavigation.NodeId
): readonly FernNavigation.NavigationNode[] | undefined {
    const node = findNodeById(rootNode, nodeId);
    if (node && "children" in node && Array.isArray(node.children)) {
        return node.children;
    }
    return undefined;
}

/**
 * Finds a node by its ID anywhere in the navigation tree.
 *
 * @param rootNode - The root of the navigation tree
 * @param nodeId - The ID of the node to find
 * @returns The node if found, or undefined
 */
export function findNodeById(
    rootNode: FernNavigation.NavigationNode,
    nodeId: FernNavigation.NodeId
): FernNavigation.NavigationNode | undefined {
    if (rootNode.id === nodeId) {
        return rootNode;
    }
    for (const child of getChildren(rootNode)) {
        const found = findNodeById(child, nodeId);
        if (found) {
            return found;
        }
    }
    return undefined;
}

/**
 * Converts a tree-level `sidebarRoot.children` index to a flat YAML layout index.
 *
 * In the navigation tree, pages at the root level live inside invisible `SidebarGroupNode`
 * wrappers. In docs.yml, the `layout` array is flat — sidebarGroup children are unwrapped
 * and interleaved with sections and API refs.
 *
 * This function expands each sidebarGroup to its children count so that the resulting
 * flat index correctly maps to the position in the YAML layout array.
 *
 * Example:
 *   sidebarRoot.children = [sidebarGroup(2 pages), section, sidebarGroup(1 page)]
 *   Tree index 0 → flat 0  (before first sidebarGroup → before its pages)
 *   Tree index 1 → flat 2  (after first sidebarGroup → after its 2 pages)
 *   Tree index 2 → flat 3  (after the section)
 *   Tree index 3 → flat 4  (after second sidebarGroup)
 *
 * @param sidebarRoot - The sidebarRoot node
 * @param treeChildrenIndex - The index among sidebarRoot.children
 * @returns The equivalent flat index in the YAML layout array
 */
export function computeSidebarRootFlatIndex(
    sidebarRoot: FernNavigation.SidebarRootNode,
    treeChildrenIndex: number
): number {
    let flat = 0;
    const limit = Math.min(treeChildrenIndex, sidebarRoot.children.length);
    for (let i = 0; i < limit; i++) {
        const child = sidebarRoot.children[i];
        flat += child?.type === "sidebarGroup" ? child.children.length : 1;
    }
    return flat;
}
