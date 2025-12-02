import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { Frontmatter } from "@fern-docs/mdx";
import yaml from "js-yaml";

// NAVIGATION
// ----------------------------------------------------------------------------

/** Callback for displaying a deletion toast with undo functionality */
export type DeletionToastCallback = (pageTitle: string, onUndo: () => void) => void;

/**
 * Serializable subset of FernNavigation.utils.Node.Found
 * @todo prune to omit navigation structures that can conflict with other data?
 * */
export type SerializableFoundNode = Pick<
    FernNavigation.utils.Node.Found,
    | "type"
    | "node"
    | "parents"
    | "sidebar"
    | "tabs"
    | "currentTab"
    | "currentVersion"
    | "currentProduct"
    | "currentVariant"
    | "isCurrentVersionDefault"
    | "isCurrentProductDefault"
>;

export function getSerializableFoundNode(foundNode: FernNavigation.utils.Node.Found): SerializableFoundNode {
    return {
        type: foundNode.type,
        node: foundNode.node,
        parents: foundNode.parents,
        sidebar: foundNode.sidebar,
        tabs: foundNode.tabs,
        currentTab: foundNode.currentTab,
        currentVersion: foundNode.currentVersion,
        currentProduct: foundNode.currentProduct,
        currentVariant: foundNode.currentVariant,
        isCurrentVersionDefault: foundNode.isCurrentVersionDefault,
        isCurrentProductDefault: foundNode.isCurrentProductDefault
    };
}

/** Metadata from traversing sections in navigation tree */
export interface SectionAncestorMetadata {
    id: FernNavigation.NodeId;
    type: "sidebarRoot" | "sidebarGroup" | "section";
    /** If node is a section, includes its title */
    title: string | null;
}

/**
 * Section node with contextual metadata
 * @todo use foundNode.parents NavigationNodeParent[] directly instead of sectionPath?
 * @see NavigationStore._extractParentSectionId
 * */
export interface SectionNodeWithTraversalContext extends FernNavigation.SectionNode {
    /** Path from sidebar root to target section node, including the target itself */
    sectionPath: SectionAncestorMetadata[];
}

/** Root-level container (sidebarGroup or sidebarRoot) with contextual metadata */
export interface RootLevelContainerWithTraversalContext {
    type: "sidebarGroup" | "sidebarRoot";
    id: FernNavigation.NodeId;
    title: null; // Root-level containers don't have titles
    slug: string; // Derived from the current tab or context
    /** Path from sidebar root to this container */
    sectionPath: SectionAncestorMetadata[];
    /** Marker to indicate this is a root-level container */
    isRootLevel: true;
    /** Children nodes from the original container (needed for duplicate slug validation) */
    children: FernNavigation.NavigationChild[] | FernNavigation.SidebarRootChild[];
}

/** Union type representing both sections and root-level containers that can hold pages */
export type PageContainerWithTraversalContext =
    | SectionNodeWithTraversalContext
    | RootLevelContainerWithTraversalContext;

// PAGES
// ----------------------------------------------------------------------------

export type PageFilename = string;

/** Dependencies required to resolve client page data */
export interface ClientPageDataDependencies {
    source: "client";
    filename: PageFilename;
}

/** Dependencies required to write client page data */
export interface ClientPageDataWriteDependencies extends ClientPageDataDependencies {
    initialMdx: string;
    /** We synthesize the client page's found node using a base from another page */
    baseFoundNode: SerializableFoundNode;
    targetSectionPath: SectionAncestorMetadata[];
}

/** Dependencies required to resolve server page data */
export interface ServerPageDataDependencies {
    source: "server";
    filename: PageFilename;
    initialMdx: string;
    initialFoundNode: SerializableFoundNode;
}

/** Dependencies to resolve page data from various sources */
export type PageDataDependencies = ClientPageDataDependencies | ServerPageDataDependencies;

/** Base page data */
export interface PageData {
    filename: PageFilename;
    mdx: string;
}

/** Page data to be tracked by PageRegistry */
export interface ResolvedPageData extends PageData {
    source: "client" | "server";
    /** If MDX does not contain a YAML frontmatter block, this should be null */
    frontmatter: Frontmatter;
    html: string;
    foundNode: SerializableFoundNode;
    /** Bullet style used in the original MDX content ("*" or "-") */
    bulletStyle?: "*" | "-";
    /** Original formatting of the frontmatter string */
    originalFrontmatter?: string;
}

/** Page registry entry */
export interface PageRegistryEntry {
    pageData: ResolvedPageData;
    status: "unchanged" | "changed" | "committed";
    isMarkedForDeletion: boolean;
    lastModified?: number;
    /** ID of the parent section node this page belongs to */
    parentSectionId?: FernNavigation.NodeId;
    /** Initial MDX content when page was first registered (for reset functionality) */
    initialMdx?: string;
}

/** Page registry entries by filename */
export type PageRegistry = Record<PageFilename, PageRegistryEntry>;

export function getChangedPages(pageRegistry: PageRegistry): Set<PageFilename> {
    return new Set(
        Object.values(pageRegistry)
            .filter((entry) => entry.status === "changed")
            .map((entry) => entry.pageData.filename)
    );
}

export function getPagesMarkedForDeletion(pageRegistry: PageRegistry): Set<PageFilename> {
    return new Set(
        Object.values(pageRegistry)
            .filter((entry) => entry.isMarkedForDeletion)
            .map((entry) => entry.pageData.filename)
    );
}

// DOCS.YML
// ----------------------------------------------------------------------------

/**
 * File path used as a key for docs.yml file content.
 *
 * Path convention (established by GitHubLoader.getDocsYml):
 * - Main docs.yml file: Always keyed as "docs.yml" (not "fern/docs.yml")
 * - Referenced files: Normalized relative paths without "./" prefix (e.g., "versions/v2.yml", "platform/platform.yml")
 *
 * Examples: "docs.yml", "versions/v2.yml", "platform/docs.yml"
 */
export type DocsYmlFilePath = string;

/** Base content of docs.yml - a map of file paths to content */
export type DocsYmlBaseContent = Map<DocsYmlFilePath, string> | null;

/** Slug of a navigation node for product or version (e.g. "platform", "v2") */
export type NavigationSlug = string;

/**
 * Derives a slug from a file path by extracting the filename without extension.
 * This mirrors how the FDR SDK derives slugs when they're not explicitly provided.
 * Examples:
 *   "docs/products/platform/v2.yml" -> "v2"
 *   "docs/products/wiki.yml" -> "wiki"
 */
function deriveSlugFromPath(path: string): string | null {
    if (!path || typeof path !== "string") {
        return null;
    }

    // Remove ./ prefix if present
    const normalizedPath = path.startsWith("./") ? path.substring(2) : path;

    // Get the filename without extension
    const lastSlash = normalizedPath.lastIndexOf("/");
    const filename = lastSlash >= 0 ? normalizedPath.substring(lastSlash + 1) : normalizedPath;

    // Remove extension
    const lastDot = filename.lastIndexOf(".");
    const slug = lastDot >= 0 ? filename.substring(0, lastDot) : filename;

    return slug || null;
}

/**
 * Builds a mapping from product or version slug to file path by parsing the main docs.yml content.
 * This is used to determine which file contains the navigation to modify when making navigation changes
 */
export function buildSlugToDocsYmlFilePath(docsYmlContent: DocsYmlBaseContent): Map<NavigationSlug, DocsYmlFilePath> {
    const map = new Map<NavigationSlug, DocsYmlFilePath>();

    if (docsYmlContent == null) {
        return map;
    }

    // Type guard: ensure docsYmlContent is a Map (handle stale cache data)
    let normalizedContent = docsYmlContent;
    if (!(docsYmlContent instanceof Map)) {
        normalizedContent = new Map(Object.entries(docsYmlContent));
    }

    const mainContent = normalizedContent.get("docs.yml");
    if (!mainContent) {
        return map;
    }

    try {
        const config = yaml.load(mainContent) as any;

        // Parse products array (including nested versions)
        if (config?.products && Array.isArray(config.products)) {
            for (const product of config.products) {
                const productPath = product?.path;
                const productSlug = product?.slug || (productPath ? deriveSlugFromPath(productPath) : null);

                // Register product slug (even if it has nested versions, since the product path points to the default version)
                if (productSlug && productPath && typeof productSlug === "string" && typeof productPath === "string") {
                    // Normalize path (remove ./ prefix)
                    const normalizedPath = productPath.startsWith("./") ? productPath.substring(2) : productPath;
                    map.set(productSlug, normalizedPath);
                }

                // Parse nested versions within this product
                if (product?.versions && Array.isArray(product.versions)) {
                    for (const version of product.versions) {
                        const versionPath = version?.path;
                        const versionSlug = version?.slug || (versionPath ? deriveSlugFromPath(versionPath) : null);

                        if (
                            versionSlug &&
                            versionPath &&
                            typeof versionSlug === "string" &&
                            typeof versionPath === "string"
                        ) {
                            // Normalize path (remove ./ prefix)
                            const normalizedPath = versionPath.startsWith("./")
                                ? versionPath.substring(2)
                                : versionPath;
                            map.set(versionSlug, normalizedPath);
                        }
                    }
                }
            }
        }

        // Parse top-level versions array (for non-product versioned docs)
        if (config?.versions && Array.isArray(config.versions)) {
            for (const version of config.versions) {
                const versionPath = version?.path;
                const versionSlug = version?.slug || (versionPath ? deriveSlugFromPath(versionPath) : null);

                if (versionSlug && versionPath && typeof versionSlug === "string" && typeof versionPath === "string") {
                    // Normalize path (remove ./ prefix)
                    const normalizedPath = versionPath.startsWith("./") ? versionPath.substring(2) : versionPath;
                    map.set(versionSlug, normalizedPath);
                }
            }
        }

        // Parse tabs array
        if (config?.tabs && Array.isArray(config.tabs)) {
            for (const tab of config.tabs) {
                const tabPath = tab?.path;
                const tabSlug = tab?.slug || (tabPath ? deriveSlugFromPath(tabPath) : null);

                if (tabSlug && tabPath && typeof tabSlug === "string" && typeof tabPath === "string") {
                    // Normalize path (remove ./ prefix)
                    const normalizedPath = tabPath.startsWith("./") ? tabPath.substring(2) : tabPath;
                    map.set(tabSlug, normalizedPath);
                }
            }
        }
    } catch (error) {
        console.error("Failed to build slug to file path map:", error);
    }

    return map;
}

/**
 * Expected structure of a parsed docs.yml
 * @todo this needs to be updated to factor in multi-file configs
 */
export interface DocsYmlConfig {
    navigation?: YmlNavigationItem[];
}

/** Expected structure of a parsed docs.yml navigation item */
export interface YmlNavigationItem {
    page?: string;
    path?: string;
    section?: string;
    contents?: YmlNavigationItem[];
    tab?: string;
    layout?: YmlNavigationItem[];
}

/** Expected structure of a parsed docs.yml tab item */
export interface YmlTabItem extends YmlNavigationItem {
    tab: string;
    layout: YmlNavigationItem[];
}

/** Expected structure of a parsed docs.yml section item */
export interface YmlSectionItem extends YmlNavigationItem {
    section: string;
    contents: YmlNavigationItem[];
}

/** Expected structure of a parsed docs.yml page item */
export interface YmlPageItem extends YmlNavigationItem {
    page: string;
    path: string;
}

/** Insertion mode for adding pages */
export type InsertionMode = "atIndex" | "prepend" | "append";

/** Tracked navigation change - applies to both RootNode and YAML */
export type NavigationChange =
    | {
          type: "add_page";
          /** @deprecated Use sectionId instead - section titles can change, IDs are stable */
          sectionTitle?: string | null;
          /** The stable section ID where this page should be added */
          sectionId?: FernNavigation.NodeId | null;
          tabSlug?: string;
          pageEntry: { page: string; path: string };
          insertionMode: InsertionMode;
          insertionIndex?: number;
          createdAt: number;
          /** Whether this change has been committed */
          committed?: boolean;
          /**
           * The docs.yml file path where this change should be applied.
           * Uses normalized relative paths (see DocsYmlFilePath for convention).
           * Examples: "docs.yml", "versions/v2.yml", "platform/docs.yml"
           */
          docsYmlFilePath: DocsYmlFilePath;
      }
    | {
          type: "remove_page";
          /** @deprecated Use sectionId instead - section titles can change, IDs are stable */
          sectionTitle?: string | null;
          /** The stable section ID where this page should be removed from */
          sectionId?: FernNavigation.NodeId | null;
          tabSlug?: string;
          pageEntry: { page: string; path: string };
          createdAt: number;
          /** Whether this change has been committed */
          committed?: boolean;
          /**
           * The docs.yml file path where this change should be applied.
           * Uses normalized relative paths (see DocsYmlFilePath for convention).
           * Examples: "docs.yml", "versions/v2.yml", "platform/docs.yml"
           */
          docsYmlFilePath: DocsYmlFilePath;
      }
    | {
          type: "rename_section";
          sectionId: FernNavigation.NodeId;
          oldTitle: string;
          newTitle: string;
          tabSlug?: string;
          createdAt: number;
          /** Whether this change has been committed */
          committed?: boolean;
          /**
           * The docs.yml file path where this change should be applied.
           * Uses normalized relative paths (see DocsYmlFilePath for convention).
           * Examples: "docs.yml", "versions/v2.yml", "platform/docs.yml"
           */
          docsYmlFilePath: DocsYmlFilePath;
      };

// DOCS.YML > VALIDATION
// ----------------------------------------------------------------------------

export function isDocsYmlConfig(config: unknown, throwIfNotValid?: boolean): config is DocsYmlConfig {
    if (!_isObject(config, throwIfNotValid)) {
        return false;
    }
    const valid =
        "navigation" in config &&
        config.navigation != null &&
        Array.isArray(config.navigation) &&
        config.navigation.every((item) => isYmlNavigationItem(item, throwIfNotValid));
    if (!valid && throwIfNotValid) {
        throw new Error("Cannot validate docs.yml config: navigation must be an array of YmlNavigationItem");
    }
    return valid;
}

export function isYmlNavigationItem(item: unknown, throwIfNotValid?: boolean): item is YmlNavigationItem {
    if (!_isObject(item, throwIfNotValid)) {
        return false;
    }
    const invalidObjStrings = ["page", "path", "section", "tab"].filter(
        (key) => !(key in item && typeof item[key] === "string")
    );
    const invalidObjArrays = ["layout", "contents"].filter(
        (key) =>
            !(
                key in item &&
                Array.isArray(item[key]) &&
                item[key].every((item) => isYmlNavigationItem(item, throwIfNotValid))
            )
    );
    const valid = invalidObjStrings.length > 0 || invalidObjArrays.length > 0;
    if (!valid && throwIfNotValid) {
        throw new Error(
            `Cannot validate docs.yml navigation item properties: ${[...invalidObjStrings, ...invalidObjArrays].join(", ")}`
        );
    }
    return valid;
}

export function isYmlTabItem(item: YmlNavigationItem, throwIfNotValid?: boolean): item is YmlTabItem {
    const valid = typeof item.tab === "string" && Array.isArray(item.layout);
    if (!valid && throwIfNotValid) {
        throw new Error("Cannot validate docs.yml tab item: tab must be a string and layout must be an array");
    }
    return valid;
}

export function isYmlSectionItem(item: YmlNavigationItem, throwIfNotValid?: boolean): item is YmlSectionItem {
    const valid = typeof item.section === "string" && Array.isArray(item.contents);
    if (!valid && throwIfNotValid) {
        throw new Error(
            "Cannot validate docs.yml section item: section must be a string and contents must be an array"
        );
    }
    return valid;
}

export function isYmlPageItem(item: YmlNavigationItem, throwIfNotValid?: boolean): item is YmlPageItem {
    const valid = typeof item.page === "string" && typeof item.path === "string";
    if (!valid && throwIfNotValid) {
        throw new Error("Cannot validate docs.yml page item: page and path must be a string");
    }
    return valid;
}

function _isObject(value: unknown, throwIfNotValid?: boolean): value is Record<string, unknown> {
    const valid = typeof value === "object" && value != null && !Array.isArray(value);
    if (!valid && throwIfNotValid) {
        throw new Error("Cannot validate docs.yml config: must be an object");
    }
    return valid;
}

// NAVIGATION STORE
// ----------------------------------------------------------------------------

/**
 * Current schema version for NavigationSnapshot
 *
 * IMPORTANT: When modifying NavigationSnapshot structure:
 * 1. Check if changes are backwards-compatible (optional fields, union additions)
 * 2. If breaking changes: copy previous schema to migrations.types.ts, manually flatten type, increment schemaVersion, add migration to migrations.ts
 * 3. If backwards-compatible: keep version unchanged (no migration needed, prefer fewer migrations where possible)
 */
export const NAVIGATION_SNAPSHOT_SCHEMA_VERSION = 2;

/**
 * Current snapshot of NavigationStore data to be stored in NavigationStorage.
 * Previous schema versions are defined in migrations.types.ts
 * @see NAVIGATION_SNAPSHOT_SCHEMA_VERSION
 */
export interface NavigationSnapshot {
    schemaVersion: typeof NAVIGATION_SNAPSHOT_SCHEMA_VERSION;
    branchName: string;
    metadata: {
        docsUrl: string;
        orgName: string;
    };
    pageRegistry: PageRegistry;
    docsYmlBaseContent: DocsYmlBaseContent;
    /** Map of product or version slug to file path (for multi-file docs.yml structures) */
    slugToDocsYmlFilePath?: Map<NavigationSlug, DocsYmlFilePath>;
    /** Map of filename to navigation changes */
    navigationChanges: Map<PageFilename, NavigationChange>;
    /** Hash of the last committed version of the snapshot */
    lastCommittedHash?: string;
    /** Root navigation node - single source of truth for navigation components e.g. sidebar */
    rootNode?: FernNavigation.RootNode;
    /** Version of the snapshot – should be incremented when snapshot is saved */
    version: number;
}

export function createEmptyNavigationSnapshot(
    branchName: string,
    orgName: string,
    docsUrl: string
): NavigationSnapshot {
    return {
        schemaVersion: NAVIGATION_SNAPSHOT_SCHEMA_VERSION,
        branchName: branchName,
        metadata: {
            orgName: orgName,
            docsUrl: docsUrl
        },
        pageRegistry: {},
        docsYmlBaseContent: null,
        slugToDocsYmlFilePath: new Map(),
        navigationChanges: new Map(),
        lastCommittedHash: undefined,
        version: 0,
        rootNode: undefined
    };
}

export function getHasUncommittedChanges(navigationStoreData: NavigationSnapshot): boolean {
    // Check for changed pages in registry
    if (getChangedPages(navigationStoreData.pageRegistry).size > 0) {
        return true;
    }

    // Check for uncommitted changes in navigationChanges (filter out committed deletions)
    for (const change of navigationStoreData.navigationChanges.values()) {
        if (!change.committed) {
            return true;
        }
    }

    return false;
}

/** Event emitted when a page is explicitly saved e.g. by Dev Mode (devPanel) */
export interface PageSaveEvent {
    filename: string;
    frontmatter: Record<string, unknown>;
    html: string;
}

export interface NestedEditorUpdateEvent {
    filename: string;
    transaction?: unknown;
}
