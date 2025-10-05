import type { FernNavigation } from "@fern-api/fdr-sdk";
import type { NodeId } from "@fern-api/fdr-sdk/navigation";
import type { Frontmatter, MdxToHtmlResponse } from "@fern-docs/mdx";

/** Serializable subset of FernNavigation.utils.Node.Found */
export type SerializableFoundNode = Pick<
    FernNavigation.utils.Node.Found,
    | "type"
    | "node"
    | "sidebar"
    | "currentTab"
    | "currentProduct"
    | "currentVersion"
    | "isCurrentVersionDefault"
    | "isCurrentProductDefault"
>;

/** Generic navigation node interface for tree traversal */
export interface NavigationNodeLike {
    type?: string;
    id?: NodeId;
    title?: string;
    children?: NavigationNodeLike[];
}

/** Navigation page entry with title and path */
export interface NavigationPageEntry {
    page: string;
    path: string;
}

/** Pending update to docs.yml configuration */
export interface DocsYmlUpdate {
    sectionTitle: string | null; // null for root-level pages
    tabSlug?: string; // tab identifier for tabbed navigation
    pageEntry: NavigationPageEntry;
    createdAt: number;
    operation?: "add" | "remove";
}

/** State for managing docs.yml file updates */
export interface DocsYmlState {
    baseContent: string; // The original docs.yml content from GitHub
    pendingUpdates: Record<string, DocsYmlUpdate>; // Pending updates keyed by page path
    lastFetched: number; // Timestamp when baseContent was last fetched
}

/** YAML navigation item structure */
interface YamlNavigationItem {
    section?: string;
    tab?: string;
    layout?: YamlNavigationItem[]; // For tabbed navigation
    page?: string;
    path?: string;
    contents?: YamlNavigationItem[];
}

/** Documentation configuration structure */
export interface DocsConfig {
    navigation?: YamlNavigationItem[];
    products?: unknown;
}

/** Core page data with content and metadata */
export interface PageData {
    html: string;
    frontmatter?: Frontmatter;
}

/** Page data with optional change tracking */
export interface PageDataWithChange extends PageData {
    changed?: boolean;
}

/** Navigation context with current product/version/tab state */
export interface NavigationContext {
    currentProduct?: FernNavigation.ProductNode;
    currentVersion?: FernNavigation.VersionNode;
    currentTab?: FernNavigation.TabChild;
    isCurrentVersionDefault?: boolean;
    isCurrentProductDefault?: boolean;
}

/** Complete navigation storage data structure */
export interface StoredNavigationData {
    clientPages: Record<
        NodeId,
        {
            node: FernNavigation.PageNode;
            parentNodeId: NodeId;
            sidebar?: FernNavigation.SidebarRootNode;
            pageData?: PageData;
            fullSlug: string;
            navigationContext?: NavigationContext;
            createdAt: number;
        }
    >;
    docsYmlState: {
        baseContent: string;
        pendingUpdates: Record<string, DocsYmlUpdate>;
        lastFetched: number;
    };
    committedFiles: Set<string>;
    pageContents: Record<
        string,
        {
            html: string;
            frontmatter?: Frontmatter;
            lastModified: number;
            pageType: "client" | "server";
        }
    >;
    lastCommittedHash?: string;
    metadata?: {
        docsUrl?: string;
        orgName?: string;
    };
}

/** Tracked page modification change */
export interface PageChange {
    type: "create" | "update" | "delete";
    filename: string;
    nodeId?: NodeId;
    pageData?: PageData;
}

/** Tracked docs.yml configuration change */
export interface ConfigChange {
    type: "add_page" | "remove_page";
    sectionTitle?: string | null; // null for root-level pages
    tabSlug?: string; // tab identifier for tabbed navigation
    pageEntry: { page: string; path: string };
}

/** Props for building page data from sources */
export interface BuildPageDataProps {
    serializableFoundNode?: SerializableFoundNode;
    clientNodeId?: NodeId;
    initialFilename?: string;
    initialHtml?: MdxToHtmlResponse["html"];
    initialFrontmatter?: MdxToHtmlResponse["frontmatter"];
    initialOriginalFrontmatter?: MdxToHtmlResponse["originalFrontmatter"];
    cssConfig?: { inline?: string[] };
}

/** Result from building page data */
export interface BuildPageDataResult {
    initialFilename?: string;
    initialHtml?: MdxToHtmlResponse["html"];
    initialFrontmatter?: MdxToHtmlResponse["frontmatter"];
    initialOriginalFrontmatter?: MdxToHtmlResponse["originalFrontmatter"];
    foundNode?: SerializableFoundNode | FernNavigation.utils.Node.Found;
}

/** Interface to track section with its parent hierarchy */
export interface SectionWithHierarchy extends FernNavigation.SectionNode {
    parentTitles: string[];
    realParentId?: FernNavigation.NodeId; // For unnamed sections, track the actual parent node ID
    isUnnamed?: boolean; // Indicates this is a synthetic unnamed section
}
