import yaml from "js-yaml";

import { compareByFractionalIndex } from "./indexingUtils";
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
    const { docsYmlBaseContent: baseContent, docsYmlChanges: changes } = navigationData;

    if (baseContent == null) {
        throw new Error("Cannot build docs.yml: base content unavailable");
    }

    if (changes.size === 0) return baseContent;

    const config = _parseDocsYmlBaseContent(baseContent);

    // Build index map and apply operations in single pass
    const indexMap = new Map<string, string>();
    for (const change of changes.values()) {
        if (change.type === "add_page" && change.pageEntry) {
            // Build index map for sorting
            if (change.index != null) {
                indexMap.set(_normalizePath(change.pageEntry.path), change.index);
            }
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

    // Sort all page entries by index after all operations
    _sortNavigationByIndex(config, indexMap);

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

/** Recursively sorts all navigation pages by fractional index in navigation root, tabs, and sections */
function _sortNavigationByIndex(docsConfig: DocsYmlConfig, indexMap: Map<string, string>): void {
    if (!docsConfig.navigation) return;

    // Sort root navigation
    _sortContainer(docsConfig.navigation, indexMap);

    // Sort tabs and their contents
    docsConfig.navigation.forEach((item) => {
        if (item.tab && item.layout) {
            _sortContainer(item.layout, indexMap);
            // Sort sections within tabs
            item.layout.forEach((layoutItem) => {
                if (layoutItem.section && layoutItem.contents) {
                    _sortContainer(layoutItem.contents, indexMap);
                }
            });
        }
    });
}

/** Sorts container by fractional index */
function _sortContainer(container: YmlNavigationItem[], indexMap: Map<string, string>): void {
    container.sort((a, b) => {
        const aPath = a.path ? _normalizePath(a.path) : null;
        const bPath = b.path ? _normalizePath(b.path) : null;
        const aIndex = aPath ? indexMap.get(aPath) : null;
        const bIndex = bPath ? indexMap.get(bPath) : null;

        return compareByFractionalIndex(aIndex, bIndex);
    });
}
