import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

export interface NavigationSnapshotV0 {
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
                sectionTitle: string | null; // null for root-level pages
                tabSlug?: string; // tab identifier for tabbed navigation
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
}
