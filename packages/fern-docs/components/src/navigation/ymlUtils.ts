import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import yaml from "js-yaml";
import {
    type DocsYmlConfig,
    isDocsYmlConfig,
    isYmlPageItem,
    isYmlSectionItem,
    isYmlTabItem,
    type NavigationSnapshot,
    type YmlNavigationItem,
    type YmlSectionItem,
    type YmlTabItem
} from "./types";

/** Applies pending page additions/removals to docs.yml */
export function buildDocsYmlFromChanges(navigationData: NavigationSnapshot): string {
    const { docsYmlBaseContent: baseContent, docsYmlChanges: changes, rootNode } = navigationData;

    if (baseContent == null) {
        throw new Error("Cannot build docs.yml: base content unavailable");
    }

    if (changes.size === 0) return baseContent;

    // LIMITATION: Multi-product docs are not supported
    // Check if this is a productgroup/multi-product docs.yml structure.
    // Multi-product docs have a `products` array where each product references its own docs.yml file.
    // To support section renaming in multi-product docs, we would need to:
    // 1. Determine which product's docs.yml file contains the section
    // 2. Load and modify that specific product's docs.yml file
    // 3. Track changes separately per product docs.yml file
    const parsedContent = yaml.load(baseContent) as any;
    if (parsedContent.products && Array.isArray(parsedContent.products)) {
        // This should not be reached since renameSection already blocks multi-product docs
        throw new Error("Section renaming in multi-product docs is not yet supported");
    }

    const config = _parseDocsYmlBaseContent(baseContent);

    // IMPORTANT: Apply operations in the correct order
    // 1. First apply all rename_section changes to update section titles
    // 2. Then apply add_page and remove_page changes using the updated titles

    // Step 1: Apply all rename operations first
    for (const change of changes.values()) {
        if (change.type === "rename_section") {
            _applyRenameSectionOperation(config, {
                oldTitle: change.oldTitle,
                newTitle: change.newTitle,
                tabSlug: change.tabSlug
            });
        }
    }

    // Step 2: Apply add/remove operations
    for (const change of changes.values()) {
        if (change.type === "add_page" && change.pageEntry) {
            // Apply add operation
            _applyAddOperation(config, {
                sectionTitle: change.sectionTitle ?? null,
                tabSlug: change.tabSlug,
                pageEntry: change.pageEntry
            });
        } else if (change.type === "remove_page" && change.pageEntry) {
            _applyRemoveOperation(config, {
                pageEntry: change.pageEntry
            });
        }
    }

    // Step 3: Sort by RootNode order (RootNode is now the single source of truth for order)
    if (rootNode) {
        const orderMap = _buildPageOrderMapFromRootNode(rootNode);
        _sortNavigationByRootNodeOrder(config, orderMap);
    }

    return yaml.dump(config, { lineWidth: -1 });
}

// HELPERS
// ----------------------------------------------------------------------------

/** Normalizes a path by removing leading "./" if present */
function _normalizePath(path: string): string {
    return path.startsWith("./") ? path.slice(2) : path;
}

/**
 * Parses and validates YAML content to DocsYmlConfig
 * @todo fully validate config for all fields we depend on in ymlUtils.ts
 * */
function _parseDocsYmlBaseContent(baseContent: string): DocsYmlConfig {
    const config = yaml.load(baseContent);

    if (isDocsYmlConfig(config, true)) {
        return config;
    }
    throw new Error("Cannot validate docs.yml config: invalid config format");
}

/** Adds a page entry to the appropriate navigation structure */
function _applyAddOperation(
    docsConfig: DocsYmlConfig,
    update: {
        sectionTitle: string | null;
        tabSlug?: string;
        pageEntry: { page: string; path: string };
    }
) {
    const { sectionTitle, tabSlug, pageEntry } = update;
    docsConfig.navigation ??= [];

    if (tabSlug) {
        _addToTabbedNavigation(docsConfig, tabSlug, sectionTitle, pageEntry);
    } else {
        _addToRootNavigation(docsConfig, sectionTitle, pageEntry);
    }
}

/** Adds a page entry to root navigation */
function _addToRootNavigation(
    docsConfig: DocsYmlConfig,
    sectionTitle: string | null,
    pageEntry: { page: string; path: string }
) {
    if (!docsConfig.navigation) return;

    if (sectionTitle == null) {
        _addPageToContainer(docsConfig.navigation, pageEntry);
    } else {
        const section = _findOrCreateSection(docsConfig.navigation, sectionTitle);
        if (section.contents) _addPageToContainer(section.contents, pageEntry);
    }
}

/** Adds a page entry to a specific tab */
function _addToTabbedNavigation(
    docsConfig: DocsYmlConfig,
    tabSlug: string,
    sectionTitle: string | null,
    pageEntry: { page: string; path: string }
) {
    if (!docsConfig.navigation) return;

    const tab = _findOrCreateTab(docsConfig.navigation, tabSlug);

    if (sectionTitle == null) {
        if (tab.layout) _addPageToContainer(tab.layout, pageEntry);
    } else {
        if (tab.layout) {
            const section = _findOrCreateSection(tab.layout, sectionTitle);
            if (section.contents) _addPageToContainer(section.contents, pageEntry);
        }
    }
}

/** Finds existing tab or creates new one */
function _findOrCreateTab(navigation: YmlNavigationItem[], tabSlug: string): YmlTabItem {
    let tab = navigation.find((item): item is YmlTabItem => isYmlTabItem(item) && item.tab === tabSlug);
    if (!tab) {
        tab = { tab: tabSlug, layout: [] };
        navigation.push(tab);
    }
    tab.layout ??= [];
    return tab;
}

/** Finds existing section or creates new one */
function _findOrCreateSection(container: YmlNavigationItem[], sectionTitle: string): YmlSectionItem {
    let section = container.find(
        (item): item is YmlSectionItem => isYmlSectionItem(item) && item.section === sectionTitle
    );
    if (!section) {
        section = { section: sectionTitle, contents: [] };
        container.push(section);
    }
    section.contents ??= [];
    return section;
}

/** Adds page entry to container if not already present */
function _addPageToContainer(container: YmlNavigationItem[], pageEntry: { page: string; path: string }) {
    const pageExists = container.some(
        (item) => isYmlPageItem(item) && (item.page === pageEntry.page || item.path === pageEntry.path)
    );

    if (!pageExists) {
        container.push(pageEntry);
    }
}

/** Removes page entry from all navigation structures */
function _applyRemoveOperation(docsConfig: DocsYmlConfig, update: { pageEntry: { page: string; path: string } }) {
    const { page, path } = update.pageEntry;

    if (!docsConfig.navigation) {
        return;
    }

    // Remove from root level navigation items
    docsConfig.navigation = docsConfig.navigation.filter((item) => !_isMatchingPage(item, page, path));

    // Remove from sections and tab layouts
    docsConfig.navigation.forEach((navItem) => {
        // Remove from section contents
        if (navItem.contents) {
            navItem.contents = navItem.contents.filter((item) => !_isMatchingPage(item, page, path));
        }

        // Remove from tab layouts
        if (navItem.layout) {
            navItem.layout = navItem.layout.filter((layoutItem) => {
                // Remove direct page items from layout
                if (layoutItem.page && layoutItem.path) {
                    return !_isMatchingPage(layoutItem, page, path);
                }

                // Remove from nested section contents in layout
                if (layoutItem.contents) {
                    layoutItem.contents = layoutItem.contents.filter((item) => !_isMatchingPage(item, page, path));
                }

                // Keep layout sections and other non-page items
                return true;
            });
        }
    });
}

/** Renames a section in the navigation structure */
function _applyRenameSectionOperation(
    docsConfig: DocsYmlConfig,
    update: { oldTitle: string; newTitle: string; tabSlug?: string }
) {
    const { oldTitle, newTitle, tabSlug } = update;

    if (!docsConfig.navigation) {
        return;
    }

    // Helper to rename section in a navigation array
    const renameSectionInArray = (items: YmlNavigationItem[]) => {
        for (const item of items) {
            // Check if this is the section we're looking for
            if (item.section === oldTitle) {
                item.section = newTitle;
            }
            // Recursively check nested sections in tabs
            if (item.layout) {
                renameSectionInArray(item.layout);
            }
        }
    };

    if (tabSlug) {
        // Rename section within a specific tab
        const tab = docsConfig.navigation.find((item) => item.tab === tabSlug);
        if (tab?.layout) {
            renameSectionInArray(tab.layout);
        }
    } else {
        // Rename section in root navigation
        renameSectionInArray(docsConfig.navigation);
    }
}

/** Checks if item matches target page by path or title */
function _isMatchingPage(item: YmlNavigationItem, targetPage: string, targetPath: string): boolean {
    // Only check page items for matches
    if (!isYmlPageItem(item)) {
        return false;
    }

    // If item has a path property, match by path (paths are unique identifiers)
    // Normalize both paths to handle "./docs/..." vs "docs/..." differences
    if (item.path && targetPath) {
        return _normalizePath(item.path) === _normalizePath(targetPath);
    }

    // Fallback to matching by page title if path is not available
    if (item.page && targetPage) {
        return item.page === targetPage;
    }

    return false;
}

/** Builds a map of pageId -> order from RootNode tree structure */
function _buildPageOrderMapFromRootNode(rootNode: FernNavigation.RootNode): Map<string, number> {
    const orderMap = new Map<string, number>();
    let orderCounter = 0;

    const traverse = (node: FernNavigation.NavigationNode): void => {
        // If this is a page node, record its order
        if (node.type === "page") {
            orderMap.set(node.pageId, orderCounter++);
            return;
        }

        // Handle node types with single child property
        if (
            node.type === "root" ||
            node.type === "unversioned" ||
            node.type === "versioned" ||
            node.type === "product"
        ) {
            traverse((node as any).child);
            return;
        }

        // Handle tab node
        if (node.type === "tab") {
            traverse(node.child);
            return;
        }

        // Handle node types with children array - traverse in order
        if (
            node.type === "sidebarRoot" ||
            node.type === "sidebarGroup" ||
            node.type === "section" ||
            node.type === "productgroup" ||
            node.type === "apiPackage"
        ) {
            for (const child of node.children) {
                traverse(child);
            }
            return;
        }

        // Handle tabbed nodes
        if (node.type === "tabbed") {
            const tabbedNode = node as any;
            const childrenArray = tabbedNode.children || tabbedNode.tabs || [];
            for (const child of childrenArray) {
                traverse(child);
            }
        }
    };

    traverse(rootNode);
    return orderMap;
}

/** Sorts navigation by RootNode order */
function _sortNavigationByRootNodeOrder(docsConfig: DocsYmlConfig, orderMap: Map<string, number>): void {
    if (!docsConfig.navigation) return;

    // Sort root navigation
    _sortContainerByRootNodeOrder(docsConfig.navigation, orderMap);

    // Sort tabs and their contents
    docsConfig.navigation.forEach((item) => {
        if (item.tab && item.layout) {
            _sortContainerByRootNodeOrder(item.layout, orderMap);
            // Sort sections within tabs
            item.layout.forEach((layoutItem) => {
                if (layoutItem.section && layoutItem.contents) {
                    _sortContainerByRootNodeOrder(layoutItem.contents, orderMap);
                }
            });
        }
        // Sort sections in root navigation
        if (item.section && item.contents) {
            _sortContainerByRootNodeOrder(item.contents, orderMap);
        }
    });
}

/** Sorts container by RootNode order */
function _sortContainerByRootNodeOrder(container: YmlNavigationItem[], orderMap: Map<string, number>): void {
    container.sort((a, b) => {
        const aPath = a.path ? _normalizePath(a.path) : null;
        const bPath = b.path ? _normalizePath(b.path) : null;

        // Extract pageId from path (path format is like "docs/pages/concepts.mdx")
        const aPageId = aPath ? (aPath as FernNavigation.PageId) : null;
        const bPageId = bPath ? (bPath as FernNavigation.PageId) : null;

        const aOrder = aPageId ? orderMap.get(aPageId) : null;
        const bOrder = bPageId ? orderMap.get(bPageId) : null;

        // Items with order come first, sorted by order
        if (aOrder != null && bOrder != null) {
            return aOrder - bOrder;
        }
        if (aOrder != null) return -1;
        if (bOrder != null) return 1;

        // Items without order maintain their relative position
        return 0;
    });
}
