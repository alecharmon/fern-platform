import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { NavigationSnapshot } from "./types";

/** Previous NavigationSnapshot schemas – used for migrations */
export interface PreviousNavigationSnapshots {
    V2: NavigationSnapshot;
    V1: {
        schemaVersion: 1;
        branchName: string;
        metadata: {
            docsUrl: string;
            orgName: string;
        };
        pageRegistry: Record<
            string,
            {
                pageData: {
                    filename: string;
                    mdx: string;
                    source: "client" | "server";
                    /** If MDX does not contain a YAML frontmatter block, this should be null */
                    frontmatter: Record<string, unknown> | null;
                    html: string;
                    foundNode: Pick<
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
                };
                status: "unchanged" | "changed" | "committed";
                isMarkedForDeletion: boolean;
                lastModified?: number;
                /** ID of the parent section node this page belongs to */
                parentSectionId?: FernNavigation.NodeId;
                /** Initial MDX content when page was first registered (for reset functionality) */
                initialMdx?: string;
            }
        >;
        docsYmlBaseContent: string | null;
        docsYmlChanges: Map<
            string,
            | {
                  type: "add_page" | "remove_page";
                  sectionTitle?: string | null;
                  tabSlug?: string;
                  pageEntry: { page: string; path: string };
                  createdAt: number;
                  /** Whether this change has been committed */
                  committed?: boolean;
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
              }
        >;
        lastCommittedHash?: string;
        version: number;
        /** Root navigation node - single source of truth for navigation structure */
        rootNode?: FernNavigation.RootNode;
    };
    V0: {
        clientPages: Record<
            string,
            {
                node: FernNavigation.PageNode;
                parentNodeId: string;
                sidebar?: FernNavigation.SidebarRootNode;
                pageData?: {
                    html: string;
                    frontmatter?: Record<string, unknown>;
                };
                fullSlug: string;
                navigationContext?: {
                    currentProduct?: FernNavigation.ProductNode;
                    currentVersion?: FernNavigation.VersionNode;
                    currentTab?: FernNavigation.TabChild;
                    isCurrentVersionDefault?: boolean;
                    isCurrentProductDefault?: boolean;
                };
                createdAt: number;
            }
        >;
        docsYmlState: {
            baseContent: string;
            pendingUpdates: Record<
                string,
                {
                    /** null for root-level pages */
                    sectionTitle: string | null;
                    /** Tab identifier for tabbed navigation */
                    tabSlug?: string;
                    pageEntry: {
                        page: string;
                        path: string;
                    };
                    createdAt: number;
                    operation?: "add" | "remove";
                }
            >;
            lastFetched: number;
        };
        committedFiles: Set<string>;
        pageContents: Record<
            string,
            {
                html: string;
                frontmatter?: Record<string, unknown>;
                lastModified: number;
                pageType: "client" | "server";
            }
        >;
        lastCommittedHash?: string;
        metadata?: {
            docsUrl?: string;
            orgName?: string;
        };
    };
}
