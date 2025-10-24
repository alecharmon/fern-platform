import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { DocsYmlChange, NavigationSnapshot } from "../types";
import { buildDocsYmlFromChanges } from "../ymlUtils";

describe("buildDocsYmlFromChanges", () => {
    const createNavSnapshot = (
        baseContent: string,
        changes: Map<string, DocsYmlChange> = new Map()
    ): NavigationSnapshot => ({
        schemaVersion: 1,
        branchName: "test-branch",
        metadata: {
            orgName: "test-org",
            docsUrl: "test-docs-url"
        },
        pageRegistry: {},
        docsYmlBaseContent: baseContent,
        docsYmlChanges: changes,
        version: 0
    });

    const createChange = (
        type: "add_page" | "remove_page",
        page: string,
        path: string,
        sectionTitle?: string | null
    ): DocsYmlChange => ({
        type,
        sectionTitle,
        pageEntry: { page, path },
        createdAt: Date.now()
    });

    it("returns base content when no pending changes", () => {
        const result = buildDocsYmlFromChanges(createNavSnapshot("navigation:\n  - page: test"));
        expect(result).toBe("navigation:\n  - page: test");
    });

    it("throws error when pending changes exist but no base content", () => {
        const changes = new Map<string, DocsYmlChange>();
        changes.set("path1.mdx", createChange("add_page", "Page1", "path1.mdx", "Section"));

        const snapshot: NavigationSnapshot = {
            schemaVersion: 1,
            branchName: "test-branch",
            metadata: {
                orgName: "test-org",
                docsUrl: "test-docs-url"
            },
            pageRegistry: {},
            docsYmlBaseContent: null, // null should trigger the error
            docsYmlChanges: changes,
            version: 0
        };

        expect(() => buildDocsYmlFromChanges(snapshot)).toThrow("Cannot build docs.yml: base content unavailable");
    });

    it("applies pending changes to existing base content", () => {
        const baseContent = `navigation:
  - section: Existing Section
    contents:
      - page: Existing Page
        path: docs/pages/existing.mdx`;

        const changes = new Map<string, DocsYmlChange>();
        changes.set("new.mdx", createChange("add_page", "New Page", "docs/pages/new.mdx", "New Section"));

        const result = buildDocsYmlFromChanges(createNavSnapshot(baseContent, changes));

        expect(result).toContain("Existing Section");
        expect(result).toContain("New Section");
    });

    it("sorts pages by RootNode order when rootNode is provided", () => {
        const baseContent = `navigation:
  - section: Test Section
    contents:
      - page: Existing Page
        path: docs/existing.mdx`;

        // Create RootNode with specific page order: Page A, Page B, Page C
        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: FernNavigation.NodeId("root"),
            version: "v2",
            title: "Root",
            slug: FernNavigation.Slug("root"),
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            pointsTo: undefined,
            roles: undefined,
            child: {
                type: "unversioned",
                id: FernNavigation.NodeId("unversioned"),
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: FernNavigation.NodeId("sidebar"),
                    children: [
                        {
                            type: "section",
                            id: FernNavigation.NodeId("section"),
                            title: "Test Section",
                            slug: FernNavigation.Slug("test-section"),
                            collapsed: false,
                            overviewPageId: undefined,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            noindex: undefined,
                            availability: undefined,
                            pointsTo: undefined,
                            children: [
                                {
                                    type: "page",
                                    id: FernNavigation.NodeId("page-a"),
                                    title: "Page A",
                                    slug: FernNavigation.Slug("page-a"),
                                    pageId: FernNavigation.PageId("docs/page-a.mdx"),
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    noindex: undefined,
                                    availability: undefined
                                },
                                {
                                    type: "page",
                                    id: FernNavigation.NodeId("page-b"),
                                    title: "Page B",
                                    slug: FernNavigation.Slug("page-b"),
                                    pageId: FernNavigation.PageId("docs/page-b.mdx"),
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    noindex: undefined,
                                    availability: undefined
                                },
                                {
                                    type: "page",
                                    id: FernNavigation.NodeId("page-c"),
                                    title: "Page C",
                                    slug: FernNavigation.Slug("page-c"),
                                    pageId: FernNavigation.PageId("docs/page-c.mdx"),
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    noindex: undefined,
                                    availability: undefined
                                }
                            ]
                        }
                    ]
                }
            }
        };

        // Add pages in reverse order (C, B, A) via changes
        const changes = new Map<string, DocsYmlChange>();
        changes.set("docs/page-c.mdx", createChange("add_page", "Page C", "docs/page-c.mdx", "Test Section"));
        changes.set("docs/page-b.mdx", createChange("add_page", "Page B", "docs/page-b.mdx", "Test Section"));
        changes.set("docs/page-a.mdx", createChange("add_page", "Page A", "docs/page-a.mdx", "Test Section"));

        const snapshot = createNavSnapshot(baseContent, changes);
        snapshot.rootNode = rootNode;

        const result = buildDocsYmlFromChanges(snapshot);

        // Parse result to verify order
        const lines = result.split("\n").filter((line) => line.includes("page:"));
        const pageOrder = lines.map((line) => line.match(/page: (.+)/)?.[1]).filter(Boolean);

        // Should be in RootNode order: A, B, C (not reverse order from changes)
        // Existing Page is not in RootNode so it stays at the end
        expect(pageOrder).toEqual(["Page A", "Page B", "Page C", "Existing Page"]);
    });
});
