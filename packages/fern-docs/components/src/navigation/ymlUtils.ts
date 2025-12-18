import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import yaml from "js-yaml";
import { findSectionTitleById } from "./navigationTreeUtils";
import {
    type DocsYmlConfig,
    type DocsYmlFilePath,
    isDocsYmlConfig,
    isYmlPageItem,
    isYmlSectionItem,
    isYmlTabItem,
    type NavigationSnapshot,
    type YmlNavigationItem,
    type YmlSectionItem,
    type YmlTabItem
} from "./types";

/** Checks if file path points to a yml file */
export function isYmlFilePath(filePath: string): boolean {
    return filePath.endsWith(".yml");
}

/**
 * Applies pending navigation changes (additions/removals/renames/etc) to docs.yml files
 * @returns Map of CHANGED files to updated content
 */
export function buildDocsYmlContentFromChanges(navigationData: NavigationSnapshot): Map<DocsYmlFilePath, string> {
    const { docsYmlBaseContent, navigationChanges, rootNode } = navigationData;

    if (docsYmlBaseContent == null) {
        throw new Error("Cannot build docs.yml files: base content unavailable");
    }

    // Build changes for each docs.yml file separately and return all CHANGED files
    return _buildDocsYmlContentFromChanges(docsYmlBaseContent, navigationChanges, rootNode);
}

function _buildDocsYmlContentFromChanges(
    docsYmlBaseContent: Map<DocsYmlFilePath, string>,
    navigationChanges: NavigationSnapshot["navigationChanges"],
    rootNode?: NavigationSnapshot["rootNode"]
): Map<DocsYmlFilePath, string> {
    const changesByFile = new Map<DocsYmlFilePath, typeof navigationChanges>();

    // Group changes by docs.yml file path
    for (const [key, change] of navigationChanges.entries()) {
        const filePath = change.docsYmlFilePath;
        let fileChanges = changesByFile.get(filePath);
        if (!fileChanges) {
            fileChanges = new Map();
            changesByFile.set(filePath, fileChanges);
        }
        fileChanges.set(key, change);
    }

    const updatedFiles = new Map<DocsYmlFilePath, string>();

    // Only process files that have changes
    for (const [filePath, fileChanges] of changesByFile.entries()) {
        const fileContent = docsYmlBaseContent.get(filePath);

        // If file has changes but no content, we can't process it
        if (!fileContent) {
            console.warn(
                `[ymlUtils] File "${filePath}" has changes but no content in docsYmlBaseContent, cannot apply changes`
            );
            continue;
        }

        const config = _parseDocsYmlBaseContent(fileContent);

        // Apply rename operations first
        for (const change of fileChanges.values()) {
            if (change.type === "rename_section") {
                _applyRenameSectionOperation(config, {
                    oldTitle: change.oldTitle,
                    newTitle: change.newTitle,
                    tabSlug: change.tabSlug
                });
            }
        }

        // Apply add/remove operations
        for (const change of fileChanges.values()) {
            if (change.type === "add_page" && change.pageEntry) {
                // Apply add operation with insertionMode and insertionIndex
                // Pass the ymlFilePath so paths can be converted to be relative to this file
                _applyAddOperation(
                    config,
                    {
                        sectionTitle: change.sectionTitle ?? null,
                        sectionId: change.sectionId ?? null,
                        tabSlug: change.tabSlug,
                        pageEntry: change.pageEntry,
                        insertionMode: change.insertionMode,
                        insertionIndex: change.insertionIndex,
                        ymlFilePath: filePath,
                        parentSectionPathTitles: change.parentSectionPathTitles
                    },
                    rootNode
                );
            } else if (change.type === "remove_page" && change.pageEntry) {
                _applyRemoveOperation(config, {
                    pageEntry: change.pageEntry,
                    ymlFilePath: filePath
                });
            }
        }

        const dumped = yaml.dump(config, { lineWidth: -1 });

        updatedFiles.set(filePath, dumped);
    }

    // Return map of CHANGED files to updated content
    return updatedFiles;
}

// HELPERS
// ----------------------------------------------------------------------------

/** Normalizes a path by removing leading "./" if present */
function _normalizePath(path: string): string {
    return path.startsWith("./") ? path.slice(2) : path;
}

/**
 * Resolves a relative path to an absolute path based on the yml file's directory.
 * This ensures we can compare paths that are relative to different yml files.
 *
 * Examples:
 *   resolveRelativePath("../../pages/platform/untitled.mdx", "docs/products/platform/v2.yml")
 *     -> "docs/pages/platform/untitled.mdx"
 *   resolveRelativePath("./pages/platform/untitled.mdx", "docs.yml")
 *     -> "pages/platform/untitled.mdx"
 *   resolveRelativePath("docs/pages/platform/untitled.mdx", "docs/products/platform/v2.yml")
 *     -> "docs/pages/platform/untitled.mdx" (already absolute, returned as-is)
 */
function resolveRelativePath(relativePath: string, ymlFilePath: string): string {
    // Normalize the path first (removes leading "./")
    const path = _normalizePath(relativePath);

    // If the path doesn't start with "../", it's already absolute (root-relative)
    // In this case, return it as-is
    if (!path.startsWith("../")) {
        return path;
    }

    // Path is relative to yml file - resolve it based on the yml file's directory
    const ymlDir = ymlFilePath.substring(0, ymlFilePath.lastIndexOf("/") + 1) || "";
    const parts = path.split("/");
    const ymlDirParts = ymlDir.split("/").filter((p) => p);

    // Count how many levels to go up
    let i = 0;
    while (i < parts.length && parts[i] === "..") {
        ymlDirParts.pop(); // Go up one directory
        i++;
    }

    // Combine the resolved directory with the remaining path
    const remainingPath = parts.slice(i).join("/");
    const resolved = ymlDirParts.length > 0 ? ymlDirParts.join("/") + "/" + remainingPath : remainingPath;

    return resolved;
}

/**
 * Converts a root-relative path to be relative to a specific yml file's directory.
 * This ensures paths are written correctly when yml files are in subdirectories.
 *
 * @param rootRelativePath - Path relative to the root docs.yml (e.g., "pages/new-page.mdx")
 * @param ymlFilePath - Path to the yml file being written (e.g., "products/platform.yml" or "docs.yml")
 * @returns Path relative to the yml file's directory (e.g., "../pages/new-page.mdx" or "./pages/new-page.mdx")
 */
function _makePathRelativeToYmlFile(rootRelativePath: string, ymlFilePath: string): string {
    // Get the directory of the yml file
    // e.g., "products/platform.yml" -> "products/"
    // e.g., "docs.yml" -> ""
    const lastSlashIndex = ymlFilePath.lastIndexOf("/");
    const ymlDir = lastSlashIndex >= 0 ? ymlFilePath.substring(0, lastSlashIndex + 1) : "";

    // If yml file is at root (docs.yml), just add "./" prefix
    if (!ymlDir) {
        return `./${rootRelativePath}`;
    }

    // If the path already starts with the yml directory, make it relative
    if (rootRelativePath.startsWith(ymlDir)) {
        const relativePath = rootRelativePath.substring(ymlDir.length);
        return `./${relativePath}`;
    }

    // Path is outside yml directory - need to calculate "../" references
    // Split both paths into segments
    const ymlSegments = ymlDir.split("/").filter((s) => s.length > 0);
    const pathSegments = rootRelativePath.split("/").filter((s) => s.length > 0);

    // Find common prefix length
    let commonLength = 0;
    while (
        commonLength < ymlSegments.length &&
        commonLength < pathSegments.length &&
        ymlSegments[commonLength] === pathSegments[commonLength]
    ) {
        commonLength++;
    }

    // Build relative path: "../" for each remaining yml segment, then remaining path segments
    const upLevels = ymlSegments.length - commonLength;
    const downPath = pathSegments.slice(commonLength);

    if (upLevels === 0) {
        // Same directory
        return `./${downPath.join("/")}`;
    } else {
        // Need to go up levels
        const ups = Array(upLevels).fill("..").join("/");
        return `${ups}/${downPath.join("/")}`;
    }
}

/**
 * Parses and validates YAML content to DocsYmlConfig
 * @todo fully validate config for all fields we depend on in ymlUtils.ts
 * */
function _parseDocsYmlBaseContent(baseContent: string): DocsYmlConfig {
    const config = yaml.load(baseContent);

    // Product/version files should have a navigation array at the top level
    // If the config is just an array, wrap it as navigation
    if (Array.isArray(config)) {
        console.warn("[ymlUtils] Config is unexpectedly an array, wrapping it as navigation:", config);
        return {
            navigation: config
        };
    }

    // If it's an object but missing navigation, try to be lenient
    if (config && typeof config === "object" && !Array.isArray(config)) {
        // If it has a navigation field, validate it
        if ("navigation" in config && isDocsYmlConfig(config, false)) {
            return config as DocsYmlConfig;
        }

        // Check if this is a main docs.yml file (has products/versions but no navigation)
        // Main docs.yml files don't have navigation at the root level - they reference other files
        if ("products" in config || "versions" in config || "tabs" in config) {
            // This is a main docs.yml file - preserve it as-is with empty navigation
            // We don't modify these files directly; navigation is in the referenced product/version files
            return {
                ...config,
                navigation: []
            };
        }

        // Otherwise, this might be a malformed file
        console.warn("[ymlUtils] Config missing navigation array, attempting recovery:", config);

        // If it looks like it might have been meant to be navigation items, wrap them
        return {
            navigation: []
        };
    }

    throw new Error("Cannot validate docs.yml config: invalid config format");
}

/** Adds a page entry to the appropriate navigation structure */
function _applyAddOperation(
    docsConfig: DocsYmlConfig,
    update: {
        /** @deprecated Fallback only - prefer sectionId which is looked up from rootNode */
        sectionTitle: string | null;
        /** Stable section ID - used to look up current section title from rootNode */
        sectionId: FernNavigation.NodeId | null;
        tabSlug?: string;
        pageEntry: { page: string; path: string };
        insertionMode?: "atIndex" | "prepend" | "append";
        insertionIndex?: number;
        ymlFilePath: DocsYmlFilePath;
        parentSectionPathTitles?: string[];
    },
    rootNode?: FernNavigation.RootNode
) {
    const {
        sectionTitle: fallbackSectionTitle,
        sectionId,
        tabSlug,
        pageEntry,
        insertionMode,
        insertionIndex,
        ymlFilePath,
        parentSectionPathTitles
    } = update;
    docsConfig.navigation ??= [];

    // If we have a sectionId, look up the CURRENT title from rootNode
    // This ensures renamed sections work correctly without needing to update the change
    // TODO: when we migrate to remote storage, clean up schema so we can always rely on access to rootNode
    let sectionTitle = fallbackSectionTitle;
    if (sectionId && rootNode) {
        const currentTitle = findSectionTitleById(rootNode, sectionId);
        if (currentTitle) {
            sectionTitle = currentTitle;
        }
    } else if (!sectionId && fallbackSectionTitle) {
        // Warn when falling back to sectionTitle (backwards compatibility with old snapshots)
        console.warn(
            `[ymlUtils] Missing sectionId for page "${pageEntry.page}" in "${ymlFilePath}". ` +
                `Falling back to sectionTitle="${fallbackSectionTitle}". This may not work correctly with renamed sections.`
        );
    }

    if (tabSlug) {
        _addToTabbedNavigation(
            docsConfig,
            tabSlug,
            sectionTitle,
            pageEntry,
            insertionMode,
            insertionIndex,
            ymlFilePath,
            parentSectionPathTitles
        );
    } else {
        _addToRootNavigation(
            docsConfig,
            sectionTitle,
            pageEntry,
            insertionMode,
            insertionIndex,
            ymlFilePath,
            parentSectionPathTitles
        );
    }
}

/** Adds a page entry to root navigation */
function _addToRootNavigation(
    docsConfig: DocsYmlConfig,
    sectionTitle: string | null,
    pageEntry: { page: string; path: string },
    insertionMode?: "atIndex" | "prepend" | "append",
    insertionIndex?: number,
    ymlFilePath?: DocsYmlFilePath,
    parentSectionPathTitles?: string[]
) {
    if (!docsConfig.navigation) {
        return;
    }

    if (sectionTitle == null) {
        _addPageToContainer(docsConfig.navigation, pageEntry, insertionMode, insertionIndex, ymlFilePath);
    } else {
        const section = _findOrCreateSectionPath(docsConfig.navigation, sectionTitle, parentSectionPathTitles);
        if (section.contents) {
            _addPageToContainer(section.contents, pageEntry, insertionMode, insertionIndex, ymlFilePath);
        }
    }
}

/** Adds a page entry to a specific tab */
function _addToTabbedNavigation(
    docsConfig: DocsYmlConfig,
    tabSlug: string,
    sectionTitle: string | null,
    pageEntry: { page: string; path: string },
    insertionMode?: "atIndex" | "prepend" | "append",
    insertionIndex?: number,
    ymlFilePath?: DocsYmlFilePath,
    parentSectionPathTitles?: string[]
) {
    if (!docsConfig.navigation) {
        return;
    }

    // Tab slug from navigation tree may be full path like "platform/v-2/guides"
    // but YAML uses just the tab identifier like "guides"
    const tabIdentifier = tabSlug.includes("/") ? (tabSlug.split("/").pop() ?? tabSlug) : tabSlug;

    const tab = _findOrCreateTab(docsConfig.navigation, tabIdentifier);

    if (sectionTitle == null) {
        if (tab.layout) {
            _addPageToContainer(tab.layout, pageEntry, insertionMode, insertionIndex, ymlFilePath);
        }
    } else {
        if (tab.layout) {
            const section = _findOrCreateSectionPath(tab.layout, sectionTitle, parentSectionPathTitles);
            if (section.contents) {
                _addPageToContainer(section.contents, pageEntry, insertionMode, insertionIndex, ymlFilePath);
            }
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

/**
 * Finds existing section or creates new one.
 * After rename operations are applied, sections should be findable by their new title.
 */
function _findOrCreateSection(container: YmlNavigationItem[], sectionTitle: string): YmlSectionItem {
    // Try to find the section by its new title (after renames have been applied)
    let section = container.find(
        (item): item is YmlSectionItem => isYmlSectionItem(item) && item.section === sectionTitle
    );

    // If not found, create a new section
    if (!section) {
        section = { section: sectionTitle, contents: [] };
        container.push(section);
    }

    section.contents ??= [];
    return section;
}

/**
 * Finds or creates a section at a specific path in the navigation hierarchy.
 * If parentSectionPathTitles is provided, navigates through the parent sections first,
 * creating them if they don't exist, then creates the target section within the final parent.
 * If parentSectionPathTitles is empty or undefined, creates the section at the root level.
 */
function _findOrCreateSectionPath(
    container: YmlNavigationItem[],
    sectionTitle: string,
    parentSectionPathTitles?: string[]
): YmlSectionItem {
    if (!parentSectionPathTitles || parentSectionPathTitles.length === 0) {
        return _findOrCreateSection(container, sectionTitle);
    }

    let currentContainer = container;
    for (const parentTitle of parentSectionPathTitles) {
        const parentSection = _findOrCreateSection(currentContainer, parentTitle);
        currentContainer = parentSection.contents ?? [];
    }

    return _findOrCreateSection(currentContainer, sectionTitle);
}

/**
 * Adds a page to a container, inserting at the correct position based on insertionMode.
 *
 * This function uses the insertionMode and insertionIndex from the NavigationChange to determine
 * where to insert the page. This ensures RootNode and YAML mutations stay in sync automatically.
 *
 * The path in pageEntry is expected to be root-relative (relative to docs.yml). This function
 * converts it to be relative to the yml file being written.
 */
function _addPageToContainer(
    container: YmlNavigationItem[],
    pageEntry: { page: string; path: string },
    insertionMode?: "atIndex" | "prepend" | "append",
    insertionIndex?: number,
    ymlFilePath?: DocsYmlFilePath
) {
    const pageExists = container.some(
        (item) => isYmlPageItem(item) && (item.page === pageEntry.page || item.path === pageEntry.path)
    );

    if (pageExists) {
        return;
    }

    // Convert path from root-relative to yml-file-relative
    // The stored path is relative to the root docs.yml, but we need to write it relative to the yml file
    const pathToWrite = ymlFilePath ? _makePathRelativeToYmlFile(pageEntry.path, ymlFilePath) : `./${pageEntry.path}`;

    const entryToWrite = {
        page: pageEntry.page,
        path: pathToWrite
    };

    // Determine insertion position based on mode
    let position: number;
    if (insertionMode === "prepend") {
        position = 0;
    } else if (insertionMode === "atIndex" && insertionIndex !== undefined) {
        position = Math.min(insertionIndex, container.length);
    } else {
        // Default to append
        position = container.length;
    }

    container.splice(position, 0, entryToWrite);
}

/** Removes page entry from all navigation structures */
function _applyRemoveOperation(
    docsConfig: DocsYmlConfig,
    update: { pageEntry: { page: string; path: string }; ymlFilePath: string }
) {
    const { page, path } = update.pageEntry;
    const { ymlFilePath } = update;

    if (!docsConfig.navigation) {
        console.warn("[ymlUtils] No navigation array in config");
        return;
    }

    // Helper function to recursively remove page from navigation items
    const removeFromItems = (items: YmlNavigationItem[]): YmlNavigationItem[] => {
        return items
            .filter((item) => !_isMatchingPage(item, page, path, ymlFilePath))
            .map((item) => {
                // Recursively process section contents
                if (item.contents) {
                    item.contents = removeFromItems(item.contents);
                }

                // Recursively process tab layouts
                if (item.layout) {
                    item.layout = removeFromItems(item.layout);
                }

                return item;
            });
    };

    // Apply removal recursively to the entire navigation tree
    docsConfig.navigation = removeFromItems(docsConfig.navigation);
}

/** Renames a section in the navigation structure */
function _applyRenameSectionOperation(
    docsConfig: DocsYmlConfig,
    update: { oldTitle: string; newTitle: string; tabSlug?: string }
) {
    const { oldTitle, newTitle, tabSlug } = update;

    if (!docsConfig.navigation) {
        console.warn("[ymlUtils] Cannot apply rename section operation: no navigation array found");
        return;
    }

    // Helper to rename section in a navigation array
    const renameSectionInArray = (items: YmlNavigationItem[], depth = 0): boolean => {
        let renamed = false;
        for (const item of items) {
            // Check if this is the section we're looking for
            if (item.section === oldTitle) {
                item.section = newTitle;
                renamed = true;
            }
            // Recursively check nested sections in tabs
            if (item.layout) {
                renamed = renameSectionInArray(item.layout, depth + 1) || renamed;
            }
        }
        return renamed;
    };

    if (tabSlug) {
        // Rename section within a specific tab
        // Tab slug from navigation tree may be full path like "platform/v-2/guides"
        // but YAML uses just the tab identifier like "guides"
        const tabIdentifier = tabSlug.includes("/") ? tabSlug.split("/").pop() : tabSlug;

        const tab = docsConfig.navigation.find((item) => item.tab === tabIdentifier);
        if (tab?.layout) {
            const renamed = renameSectionInArray(tab.layout);
            if (!renamed) {
                console.warn(
                    `[ymlUtils] Section "${oldTitle}" not found in tab "${tabIdentifier}" (from slug: "${tabSlug}")`
                );
            }
        } else {
            console.warn(
                `[ymlUtils] Tab "${tabIdentifier}" (from slug: "${tabSlug}") not found in navigation. Available tabs:`,
                docsConfig.navigation.map((item) => item.tab)
            );
        }
    } else {
        // Rename section in root navigation
        const renamed = renameSectionInArray(docsConfig.navigation);
        if (!renamed) {
            console.warn(`[ymlUtils] Section "${oldTitle}" not found in root navigation`);
        }
    }
}

/** Checks if item matches target page by path or title */
function _isMatchingPage(
    item: YmlNavigationItem,
    targetPage: string,
    targetPath: string,
    ymlFilePath: string
): boolean {
    // Only check page items for matches
    if (!isYmlPageItem(item)) {
        return false;
    }

    // If item has a path property, match by path (paths are unique identifiers)
    // Resolve both paths to absolute before comparing, since they may be relative to different locations
    if (item.path && targetPath) {
        // Resolve item path (which is relative to the yml file)
        const resolvedItemPath = resolveRelativePath(item.path, ymlFilePath);
        // Resolve target path (which may be root-relative or yml-relative)
        const resolvedTargetPath = resolveRelativePath(targetPath, ymlFilePath);

        return resolvedItemPath === resolvedTargetPath;
    }

    // Fallback to matching by page title if path is not available
    if (item.page && targetPage) {
        return item.page === targetPage;
    }

    return false;
}
