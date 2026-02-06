import * as FernNavigation from "@fern-api/fdr-sdk/navigation";

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

/** Injects a page node into a section within the navigation tree immutably */
export function injectPageIntoSection(
    rootNode: FernNavigation.RootNode,
    pageNode: FernNavigation.PageNode,
    parentSectionId: FernNavigation.NodeId,
    insertionMode: "atIndex" | "prepend" | "append" = "append",
    insertionIndex?: number
): FernNavigation.RootNode {
    let injected = false;

    const injectNode = <T extends FernNavigation.NavigationNode>(node: T): T => {
        // If already injected, just return the node
        if (injected) {
            return node;
        }

        // If this is the target parent (section, sidebarGroup, or sidebarRoot), add the page
        if (
            (node.type === "section" || node.type === "sidebarGroup" || node.type === "sidebarRoot") &&
            node.id === parentSectionId
        ) {
            injected = true;
            const children = [...(node as any).children];

            // Determine insertion position based on mode
            let position: number;
            if (insertionMode === "prepend") {
                position = 0;
            } else if (insertionMode === "atIndex" && insertionIndex !== undefined) {
                position = Math.min(insertionIndex, children.length);
            } else {
                // Default to append
                position = children.length;
            }

            // For sidebarRoot when no sidebarGroups exist, we need to create one
            if (node.type === "sidebarRoot") {
                const hasSidebarGroup = children.some((child: any) => child.type === "sidebarGroup");
                if (!hasSidebarGroup) {
                    // Create a new sidebarGroup to wrap the page
                    const newSidebarGroup: FernNavigation.SidebarGroupNode = {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId(`${node.id}:sidebarGroup:0`),
                        children: [pageNode]
                    };
                    children.splice(position, 0, newSidebarGroup);
                    return { ...node, children } as T;
                }
            }

            children.splice(position, 0, pageNode);
            return { ...node, children } as T;
        }

        // Recursively search children
        switch (node.type) {
            case "root":
                return { ...node, child: injectNode(node.child) } as T;
            case "unversioned":
                return { ...node, child: injectNode(node.child) } as T;
            case "product":
                return { ...node, child: injectNode((node as any).child) } as T;
            case "versioned": {
                // Versioned node has children array of version nodes
                const versionedNode = node as any;
                if (versionedNode.children && Array.isArray(versionedNode.children)) {
                    return {
                        ...node,
                        children: versionedNode.children.map((child: any) => injectNode(child))
                    } as T;
                }
                return node;
            }
            case "version":
                return { ...node, child: injectNode((node as any).child) } as T;
            case "tabbed": {
                const tabbedNode = node as any;
                if (tabbedNode.tabs && Array.isArray(tabbedNode.tabs)) {
                    return {
                        ...node,
                        tabs: tabbedNode.tabs.map((tab: any) => injectNode(tab))
                    } as T;
                } else if (tabbedNode.children && Array.isArray(tabbedNode.children)) {
                    return {
                        ...node,
                        children: tabbedNode.children.map((child: any) => injectNode(child))
                    } as T;
                } else {
                    return node;
                }
            }
            case "productgroup":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "sidebarRoot":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "sidebarGroup":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "section":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "tab":
                return { ...node, child: injectNode(node.child) } as T;
            case "apiPackage":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            default:
                return node;
        }
    };

    return injectNode(rootNode);
}

/** Injects a section node into a container within the navigation tree immutably */
export function injectSectionIntoContainer(
    rootNode: FernNavigation.RootNode,
    sectionNode: FernNavigation.SectionNode,
    parentContainerId: FernNavigation.NodeId,
    insertionMode: "atIndex" | "prepend" | "append" = "append",
    insertionIndex?: number
): FernNavigation.RootNode {
    let injected = false;

    const injectNode = <T extends FernNavigation.NavigationNode>(node: T): T => {
        // If already injected, just return the node
        if (injected) {
            return node;
        }

        // If this is the target parent (section, sidebarGroup, or sidebarRoot), add the section
        if (
            (node.type === "section" || node.type === "sidebarGroup" || node.type === "sidebarRoot") &&
            node.id === parentContainerId
        ) {
            injected = true;
            const children = [...(node as any).children];

            // Determine insertion position based on mode
            let position: number;
            if (insertionMode === "prepend") {
                position = 0;
            } else if (insertionMode === "atIndex" && insertionIndex !== undefined) {
                position = Math.min(insertionIndex, children.length);
            } else {
                // Default to append
                position = children.length;
            }

            children.splice(position, 0, sectionNode);
            return { ...node, children } as T;
        }

        // Recursively search children
        switch (node.type) {
            case "root":
                return { ...node, child: injectNode(node.child) } as T;
            case "unversioned":
                return { ...node, child: injectNode(node.child) } as T;
            case "product":
                return { ...node, child: injectNode((node as any).child) } as T;
            case "versioned": {
                // Versioned node has children array of version nodes
                const versionedNode = node as any;
                if (versionedNode.children && Array.isArray(versionedNode.children)) {
                    return {
                        ...node,
                        children: versionedNode.children.map((child: any) => injectNode(child))
                    } as T;
                }
                return node;
            }
            case "version":
                return { ...node, child: injectNode((node as any).child) } as T;
            case "tabbed": {
                const tabbedNode = node as any;
                if (tabbedNode.tabs && Array.isArray(tabbedNode.tabs)) {
                    return {
                        ...node,
                        tabs: tabbedNode.tabs.map((tab: any) => injectNode(tab))
                    } as T;
                } else if (tabbedNode.children && Array.isArray(tabbedNode.children)) {
                    return {
                        ...node,
                        children: tabbedNode.children.map((child: any) => injectNode(child))
                    } as T;
                } else {
                    return node;
                }
            }
            case "productgroup":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "sidebarRoot":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "sidebarGroup":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "section":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            case "tab":
                return { ...node, child: injectNode(node.child) } as T;
            case "apiPackage":
                return {
                    ...node,
                    children: node.children.map((child) => injectNode(child))
                } as T;
            default:
                return node;
        }
    };

    return injectNode(rootNode);
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
 * Calculates the insertion index for a new page within a container (section, sidebarGroup, or sidebarRoot).
 *
 * Insertion behavior:
 * - For sidebarGroups (root-level): Pages are inserted BEFORE non-page items (sections, API refs, etc.)
 *   This ensures pages appear before structural elements in the docs.yml
 *   Note: sidebarGroups are unwrapped in YAML, so we need to find the parent context
 * - For sidebarRoot (when no sidebarGroups exist): Pages are appended to the end
 * - For sections: Pages are appended to the end
 *
 * @param treeNode - The RootNode or SidebarRootNode to search in
 * @param containerId - The ID of the container (section, sidebarGroup, or sidebarRoot) to insert into
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

    // Check if containerId is a sidebarRoot (when no sidebarGroups exist)
    if (treeNode.type === "sidebarRoot" && treeNode.id === containerId) {
        const children = treeNode.children;
        // Append to the end of all children
        if (excludePageId) {
            return children.filter(
                (child: any) => !(child.type === "page" && (child as FernNavigation.PageNode).pageId === excludePageId)
            ).length;
        }
        return children.length;
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
