import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

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
        if (node.type === "section" && node.id === sectionId) {
            result = { section: node, tabSlug: tab, product, version };
            return true;
        }

        // Handle node types with single child property
        if (node.type === "root" || node.type === "unversioned") {
            return traverse((node as any).child, tab, product, version);
        }

        // Handle versioned node - track the version
        if (node.type === "versioned") {
            return traverse((node as any).child, tab, product, node as any);
        }

        // Handle product node - track the product
        if (node.type === "product") {
            return traverse((node as any).child, tab, node as any, version);
        }

        // Handle tabbed nodes - they have children array
        if (node.type === "tabbed") {
            for (const child of (node as any).children) {
                if (traverse(child, tab, product, version)) return true;
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
            for (const child of node.children) {
                if (traverse(child, tab, product, version)) return true;
            }
        }

        // Handle tab node specially - track the tab slug
        if (node.type === "tab") {
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
        if (node.type === "page" && node.pageId === pageId) {
            result = { page: node, tabSlug: tab, product, version };
            return true;
        }

        // Handle node types with single child property
        if (node.type === "root" || node.type === "unversioned") {
            return traverse((node as any).child, tab, product, version);
        }

        // Handle versioned node - track the version
        if (node.type === "versioned") {
            return traverse((node as any).child, tab, product, node as any);
        }

        // Handle product node - track the product
        if (node.type === "product") {
            return traverse((node as any).child, tab, node as any, version);
        }

        // Handle tabbed nodes - they have children array
        if (node.type === "tabbed") {
            for (const child of (node as any).children) {
                if (traverse(child, tab, product, version)) return true;
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
                if (traverse(child, tab, product, version)) return true;
            }
        }

        // Handle tab node specially - track the tab slug
        if (node.type === "tab") {
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
        if (injected) return node;

        // If this is the target parent section, add the page
        if (node.type === "section" && node.id === parentSectionId) {
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
