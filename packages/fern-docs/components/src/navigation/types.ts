import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { Frontmatter } from "@fern-docs/mdx";

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
        isCurrentVersionDefault: foundNode.isCurrentVersionDefault,
        isCurrentProductDefault: foundNode.isCurrentProductDefault
    };
}

export function mergeFoundNodes(
    foundNode: SerializableFoundNode,
    fallbackFoundNode?: SerializableFoundNode
): SerializableFoundNode {
    // NavigationSnapshotV0 node.id is malformed; we need to correct it if data comes from migrated page
    const nodeId =
        foundNode.node.type === "page" &&
        (foundNode.node.id as string) === (foundNode.node.pageId as string) &&
        fallbackFoundNode?.node.id
            ? fallbackFoundNode?.node.id
            : undefined;

    return {
        ...foundNode,
        node: {
            ...(foundNode.node ?? fallbackFoundNode?.node),
            id: nodeId ?? foundNode.node?.id ?? fallbackFoundNode?.node?.id
        },
        parents: foundNode.parents.length > 0 ? foundNode.parents : (fallbackFoundNode?.parents ?? []),
        sidebar: foundNode.sidebar ?? fallbackFoundNode?.sidebar,
        tabs: foundNode.tabs.length > 0 ? foundNode.tabs : (fallbackFoundNode?.tabs ?? []),
        currentTab: foundNode.currentTab ?? fallbackFoundNode?.currentTab,
        currentVersion: foundNode.currentVersion ?? fallbackFoundNode?.currentVersion,
        currentProduct: foundNode.currentProduct ?? fallbackFoundNode?.currentProduct,
        isCurrentVersionDefault:
            foundNode.isCurrentVersionDefault ?? fallbackFoundNode?.isCurrentVersionDefault ?? false,
        isCurrentProductDefault:
            foundNode.isCurrentProductDefault ?? fallbackFoundNode?.isCurrentProductDefault ?? false
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
}

/** Page registry entry */
export interface PageRegistryEntry {
    pageData: ResolvedPageData;
    status: "unchanged" | "changed" | "committed";
    isMarkedForDeletion: boolean;
    index?: string;
    lastModified?: number;
    /** ID of the parent section node this page belongs to */
    parentSectionId?: FernNavigation.NodeId;
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

/** Base content of docs.yml */
export type DocsYmlBaseContent = string | null;

/** Expected structure of a parsed docs.yml */
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

/** Tracked docs.yml configuration change */
export interface DocsYmlChange {
    type: "add_page" | "remove_page";
    sectionTitle?: string | null;
    tabSlug?: string;
    pageEntry: { page: string; path: string };
    createdAt: number;
    /** Fractional index for the page */
    index?: string;
}

/** Tracked docs.yml configuration changes by filename */
export type DocsYmlChanges = Map<PageFilename, DocsYmlChange>;

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

/** Current schema version for NavigationSnapshot */
export const NAVIGATION_SNAPSHOT_SCHEMA_VERSION = 1;

/** Snapshot of NavigationStore data stored in NavigationStorage */
export interface NavigationSnapshot {
    schemaVersion: number;
    branchName: string;
    metadata: {
        docsUrl: string;
        orgName: string;
    };
    pageRegistry: PageRegistry;
    docsYmlBaseContent: DocsYmlBaseContent;
    docsYmlChanges: DocsYmlChanges;
    lastCommittedHash?: string;
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
        docsYmlChanges: new Map(),
        lastCommittedHash: undefined,
        version: 0
    };
}

export function getHasUncommittedChanges(navigationStoreData: NavigationSnapshot): boolean {
    return getChangedPages(navigationStoreData.pageRegistry).size > 0 || navigationStoreData.docsYmlChanges.size > 0;
}

/** Event emitted when a page is explicitly saved e.g. by Dev Mode (devPanel) */
export interface PageSaveEvent {
    filename: string;
    frontmatter: Record<string, unknown>;
    html: string;
}
