import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { createEmptyNavigationSnapshot, type NavigationChange, type NavigationSnapshot } from "../types";
import { buildDocsYmlContentFromChanges } from "../ymlUtils";

describe("buildDocsYmlContentFromChanges", () => {
    const createNavSnapshot = (
        baseContent: string,
        changes: Map<string, NavigationChange> = new Map()
    ): NavigationSnapshot => ({
        ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
        docsYmlBaseContent: new Map([["docs.yml", baseContent]]),
        navigationChanges: changes
    });

    const createChange = (
        type: "add_page" | "remove_page",
        page: string,
        path: string,
        sectionTitle?: string | null
    ): NavigationChange => {
        if (type === "add_page") {
            return {
                type,
                sectionTitle,
                pageEntry: { page, path },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                createdAt: Date.now()
            };
        }
        return {
            type,
            sectionTitle,
            pageEntry: { page, path },
            docsYmlFilePath: "docs.yml",
            createdAt: Date.now()
        };
    };

    it("returns empty map when no pending changes", () => {
        const result = buildDocsYmlContentFromChanges(createNavSnapshot("navigation:\n  - page: test"));
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(0); // No changes = empty map
    });

    it("throws error when pending changes exist but no base content", () => {
        const changes = new Map<string, NavigationChange>();
        changes.set("path1.mdx", createChange("add_page", "Page1", "path1.mdx", "Section"));

        const snapshot: NavigationSnapshot = {
            ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
            docsYmlBaseContent: null, // null should trigger the error
            navigationChanges: changes
        };

        expect(() => buildDocsYmlContentFromChanges(snapshot)).toThrow(
            "Cannot build docs.yml files: base content unavailable"
        );
    });

    it("applies pending changes to existing base content", () => {
        const baseContent = `navigation:
  - section: Existing Section
    contents:
      - page: Existing Page
        path: docs/pages/existing.mdx`;

        const changes = new Map<string, NavigationChange>();
        changes.set("new.mdx", createChange("add_page", "New Page", "docs/pages/new.mdx", "New Section"));

        const result = buildDocsYmlContentFromChanges(createNavSnapshot(baseContent, changes));

        expect(result).toBeInstanceOf(Map);
        const resultString = result.get("docs.yml") ?? "";

        expect(resultString).toContain("Existing Section");
        expect(resultString).toContain("New Section");
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
            collapsed: undefined,
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
                collapsed: undefined,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: FernNavigation.NodeId("sidebar"),
                    collapsed: undefined,
                    children: [
                        {
                            type: "section",
                            id: FernNavigation.NodeId("section"),
                            title: "Test Section",
                            slug: FernNavigation.Slug("test-section"),
                            collapsed: false,
                            collapsible: undefined,
                            collapsedByDefault: undefined,
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
                                    collapsed: undefined,
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
                                    collapsed: undefined,
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
                                    collapsed: undefined,
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

        // Add pages in reverse order (C, B, A) via changes, but with correct insertion indices from RootNode
        const changes = new Map<string, NavigationChange>();
        // Page A is first in RootNode (index 0)
        changes.set("docs/page-a.mdx", {
            type: "add_page",
            sectionTitle: "Test Section",
            pageEntry: { page: "Page A", path: "docs/page-a.mdx" },
            insertionMode: "atIndex",
            insertionIndex: 0,
            docsYmlFilePath: "docs.yml",
            createdAt: Date.now()
        });
        // Page B is second in RootNode (index 1)
        changes.set("docs/page-b.mdx", {
            type: "add_page",
            sectionTitle: "Test Section",
            pageEntry: { page: "Page B", path: "docs/page-b.mdx" },
            insertionMode: "atIndex",
            insertionIndex: 1,
            docsYmlFilePath: "docs.yml",
            createdAt: Date.now()
        });
        // Page C is third in RootNode (index 2)
        changes.set("docs/page-c.mdx", {
            type: "add_page",
            sectionTitle: "Test Section",
            pageEntry: { page: "Page C", path: "docs/page-c.mdx" },
            insertionMode: "atIndex",
            insertionIndex: 2,
            docsYmlFilePath: "docs.yml",
            createdAt: Date.now()
        });

        const snapshot = createNavSnapshot(baseContent, changes);
        snapshot.rootNode = rootNode;

        const result = buildDocsYmlContentFromChanges(snapshot);

        expect(result).toBeInstanceOf(Map);
        const resultString = result.get("docs.yml") ?? "";

        // Parse result to verify order
        const lines = resultString.split("\n").filter((line: string) => line.includes("page:"));
        const pageOrder = lines.map((line: string) => line.match(/page: (.+)/)?.[1]).filter(Boolean);

        // Should be in RootNode order: A, B, C (not reverse order from changes)
        // Existing Page is not in RootNode so it stays at the end
        expect(pageOrder).toEqual(["Page A", "Page B", "Page C", "Existing Page"]);
    });

    it("handles multiple consecutive section renames correctly", () => {
        const baseContent = `navigation:
  - section: Original Section
    contents:
      - page: Test Page
        path: docs/test.mdx`;

        const changes = new Map<string, NavigationChange>();
        // Simulate renaming the same section multiple times
        // This should be collapsed into a single rename: "Original Section" -> "Third Rename"
        changes.set("section-rename-test", {
            type: "rename_section",
            sectionId: FernNavigation.NodeId("test-section"),
            oldTitle: "Original Section",
            newTitle: "Third Rename",
            docsYmlFilePath: "docs.yml",
            createdAt: Date.now()
        });

        const result = buildDocsYmlContentFromChanges(createNavSnapshot(baseContent, changes));

        expect(result).toBeInstanceOf(Map);
        const resultString = result.get("docs.yml") ?? "";

        // Original section should be renamed
        expect(resultString).not.toContain("Original Section");
        expect(resultString).toContain("Third Rename");
        expect(resultString).toContain("Test Page");
    });

    describe("multi-file config path handling", () => {
        it("should write paths relative to non-root yml files", () => {
            // Setup: Root docs.yml references products/platform.yml
            const rootDocsYml = `navigation:
  - page: Welcome
    path: ./pages/welcome.mdx`;

            const platformYml = `navigation:
  - section: Platform Section
    contents:
      - page: Existing Page
        path: ./pages/existing.mdx`;

            // Create a snapshot with both files
            const snapshot: NavigationSnapshot = {
                ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
                docsYmlBaseContent: new Map([
                    ["docs.yml", rootDocsYml],
                    ["products/platform.yml", platformYml]
                ]),
                navigationChanges: new Map()
            };

            // Add a new page to the platform product
            // The path is stored as root-relative: "pages/new-page.mdx"
            // But should be written as: "../pages/new-page.mdx" in products/platform.yml
            const changes = new Map<string, NavigationChange>();
            changes.set("pages/new-page.mdx", {
                type: "add_page",
                sectionTitle: "Platform Section",
                pageEntry: { page: "New Page", path: "pages/new-page.mdx" }, // Root-relative path
                insertionMode: "append",
                docsYmlFilePath: "products/platform.yml",
                createdAt: Date.now()
            });

            snapshot.navigationChanges = changes;

            // Build the updated yml content
            const result = buildDocsYmlContentFromChanges(snapshot);

            // Should only have products/platform.yml in result (docs.yml unchanged)
            expect(result.size).toBe(1);
            expect(result.has("products/platform.yml")).toBe(true);

            const platformYmlResult = result.get("products/platform.yml") ?? "";

            // The new page should be written with a relative path: ../pages/new-page.mdx
            expect(platformYmlResult).toContain("New Page");
            expect(platformYmlResult).toContain("../pages/new-page.mdx");
            // Should NOT contain the root-relative path
            expect(platformYmlResult).not.toContain("path: pages/new-page.mdx");
            expect(platformYmlResult).not.toContain("path: ./pages/new-page.mdx");
        });

        it("should write paths relative to nested version yml files", () => {
            // Setup: versions/v2.yml in a subdirectory
            const v2Yml = `navigation:
  - section: API Reference
    contents:
      - page: Introduction
        path: ./intro.mdx`;

            const snapshot: NavigationSnapshot = {
                ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
                docsYmlBaseContent: new Map([["versions/v2.yml", v2Yml]]),
                navigationChanges: new Map()
            };

            // Add a page in the root pages directory
            // Stored path: "pages/guide.mdx" (root-relative)
            // Should be written as: "../pages/guide.mdx" in versions/v2.yml
            const changes = new Map<string, NavigationChange>();
            changes.set("pages/guide.mdx", {
                type: "add_page",
                sectionTitle: "API Reference",
                pageEntry: { page: "Guide", path: "pages/guide.mdx" }, // Root-relative
                insertionMode: "append",
                docsYmlFilePath: "versions/v2.yml",
                createdAt: Date.now()
            });

            snapshot.navigationChanges = changes;

            const result = buildDocsYmlContentFromChanges(snapshot);
            const v2YmlResult = result.get("versions/v2.yml") ?? "";

            expect(v2YmlResult).toContain("Guide");
            expect(v2YmlResult).toContain("../pages/guide.mdx");
        });

        it("should handle pages in same directory as yml file", () => {
            // Setup: products/platform.yml and pages are in products/pages/
            const platformYml = `navigation:
  - section: Platform
    contents: []`;

            const snapshot: NavigationSnapshot = {
                ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
                docsYmlBaseContent: new Map([["products/platform.yml", platformYml]]),
                navigationChanges: new Map()
            };

            // Add a page in the same directory structure
            // Stored path: "products/pages/new.mdx" (root-relative)
            // Should be written as: "./pages/new.mdx" in products/platform.yml
            const changes = new Map<string, NavigationChange>();
            changes.set("products/pages/new.mdx", {
                type: "add_page",
                sectionTitle: "Platform",
                pageEntry: { page: "New Page", path: "products/pages/new.mdx" }, // Root-relative
                insertionMode: "append",
                docsYmlFilePath: "products/platform.yml",
                createdAt: Date.now()
            });

            snapshot.navigationChanges = changes;

            const result = buildDocsYmlContentFromChanges(snapshot);
            const platformYmlResult = result.get("products/platform.yml") ?? "";

            expect(platformYmlResult).toContain("New Page");
            expect(platformYmlResult).toContain("./pages/new.mdx");
            // Should NOT contain the full path
            expect(platformYmlResult).not.toContain("products/pages/new.mdx");
        });

        it("should handle root docs.yml correctly", () => {
            // When yml file is at root (docs.yml), paths should just get "./" prefix
            const docsYml = `navigation:
  - section: Root Section
    contents: []`;

            const snapshot: NavigationSnapshot = {
                ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
                docsYmlBaseContent: new Map([["docs.yml", docsYml]]),
                navigationChanges: new Map()
            };

            // Add a page to root docs.yml
            // Stored path: "pages/new.mdx" (root-relative, which is the same as file-relative for root)
            // Should be written as: "./pages/new.mdx"
            const changes = new Map<string, NavigationChange>();
            changes.set("pages/new.mdx", {
                type: "add_page",
                sectionTitle: "Root Section",
                pageEntry: { page: "New Page", path: "pages/new.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                createdAt: Date.now()
            });

            snapshot.navigationChanges = changes;

            const result = buildDocsYmlContentFromChanges(snapshot);
            const docsYmlResult = result.get("docs.yml") ?? "";

            expect(docsYmlResult).toContain("New Page");
            expect(docsYmlResult).toContain("./pages/new.mdx");
        });

        it("should remove pages with paths relative to nested yml files", () => {
            // Setup: products/platform/v2.yml with pages at ../../pages/platform/
            const v2Yml = `navigation:
  - section: Overview
    contents:
      - page: Getting Started
        path: ../../pages/platform/getting-started.mdx
      - page: Introduction
        path: ../../pages/platform/introduction.mdx`;

            const snapshot: NavigationSnapshot = {
                ...createEmptyNavigationSnapshot("test-branch", "test-org", "test-docs-url"),
                docsYmlBaseContent: new Map([["docs/products/platform/v2.yml", v2Yml]]),
                navigationChanges: new Map()
            };

            // Remove the introduction page
            // Stored path is root-relative: "docs/pages/platform/introduction.mdx"
            // YAML has it as: "../../pages/platform/introduction.mdx" (relative to docs/products/platform/v2.yml)
            // Both should resolve to the same absolute path: "docs/pages/platform/introduction.mdx"
            const changes = new Map<string, NavigationChange>();
            changes.set("docs/pages/platform/introduction.mdx", {
                type: "remove_page",
                sectionTitle: "Overview",
                pageEntry: { page: "Introduction", path: "docs/pages/platform/introduction.mdx" },
                docsYmlFilePath: "docs/products/platform/v2.yml",
                createdAt: Date.now()
            });

            snapshot.navigationChanges = changes;

            const result = buildDocsYmlContentFromChanges(snapshot);
            const v2YmlResult = result.get("docs/products/platform/v2.yml") ?? "";

            // The introduction page should be removed
            expect(v2YmlResult).not.toContain("Introduction");
            expect(v2YmlResult).not.toContain("../../pages/platform/introduction.mdx");
            // But the getting started page should still be there
            expect(v2YmlResult).toContain("Getting Started");
            expect(v2YmlResult).toContain("../../pages/platform/getting-started.mdx");
        });
    });

    describe("nested section creation", () => {
        it("should create nested sections correctly with parentSectionPathTitles", () => {
            const baseContent = `navigation: []`;

            const changes = new Map<string, NavigationChange>();

            changes.set("pages/page-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1",
                pageEntry: { page: "page 1", path: "pages/page-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: [], // Root level
                createdAt: Date.now()
            });

            changes.set("pages/page-1-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1.1",
                pageEntry: { page: "page 1.1", path: "pages/page-1-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: ["section 1"], // Nested under "section 1"
                createdAt: Date.now() + 1
            });

            const result = buildDocsYmlContentFromChanges(createNavSnapshot(baseContent, changes));
            const resultString = result.get("docs.yml") ?? "";

            expect(resultString).toContain("section 1");
            expect(resultString).toContain("section 1.1");
            expect(resultString).toContain("page 1");
            expect(resultString).toContain("page 1.1");

            // Parse the YAML to verify nesting structure
            const lines = resultString.split("\n");
            const section1Index = lines.findIndex((line) => line.includes("section: section 1"));
            const section11Index = lines.findIndex((line) => line.includes("section: section 1.1"));

            expect(section11Index).toBeGreaterThan(section1Index);

            const section1Indent = lines[section1Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            const section11Indent = lines[section11Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            expect(section11Indent).toBeGreaterThan(section1Indent);
        });

        it("should create deeply nested sections with multiple levels", () => {
            const baseContent = `navigation: []`;

            const changes = new Map<string, NavigationChange>();

            // Create "section 1" at root
            changes.set("pages/page-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1",
                pageEntry: { page: "page 1", path: "pages/page-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: [],
                createdAt: Date.now()
            });

            // Create "section 1.1" under "section 1"
            changes.set("pages/page-1-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1.1",
                pageEntry: { page: "page 1.1", path: "pages/page-1-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: ["section 1"],
                createdAt: Date.now() + 1
            });

            // Create "section 1.1.1" under "section 1" > "section 1.1"
            changes.set("pages/page-1-1-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1.1.1",
                pageEntry: { page: "page 1.1.1", path: "pages/page-1-1-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: ["section 1", "section 1.1"],
                createdAt: Date.now() + 2
            });

            const result = buildDocsYmlContentFromChanges(createNavSnapshot(baseContent, changes));
            const resultString = result.get("docs.yml") ?? "";

            expect(resultString).toContain("section 1");
            expect(resultString).toContain("section 1.1");
            expect(resultString).toContain("section 1.1.1");
            expect(resultString).toContain("page 1");
            expect(resultString).toContain("page 1.1");
            expect(resultString).toContain("page 1.1.1");

            const lines = resultString.split("\n");
            const section1Index = lines.findIndex(
                (line) => line.includes("section: section 1") && !line.includes("1.1")
            );
            const section11Index = lines.findIndex(
                (line) => line.includes("section: section 1.1") && !line.includes("1.1.1")
            );
            const section111Index = lines.findIndex((line) => line.includes("section: section 1.1.1"));

            // Verify order
            expect(section11Index).toBeGreaterThan(section1Index);
            expect(section111Index).toBeGreaterThan(section11Index);

            const section1Indent = lines[section1Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            const section11Indent = lines[section11Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            const section111Indent = lines[section111Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            expect(section11Indent).toBeGreaterThan(section1Indent);
            expect(section111Indent).toBeGreaterThan(section11Indent);
        });

        it("should create nested sections in tabs correctly", () => {
            const baseContent = `navigation:
  - tab: guides
    layout: []`;

            const changes = new Map<string, NavigationChange>();

            // Create "section 1" in tab "guides"
            changes.set("pages/page-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1",
                tabSlug: "guides",
                pageEntry: { page: "page 1", path: "pages/page-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: [],
                createdAt: Date.now()
            });

            // Create "section 1.1" nested under "section 1" in tab "guides"
            changes.set("pages/page-1-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1.1",
                tabSlug: "guides",
                pageEntry: { page: "page 1.1", path: "pages/page-1-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                parentSectionPathTitles: ["section 1"],
                createdAt: Date.now() + 1
            });

            const result = buildDocsYmlContentFromChanges(createNavSnapshot(baseContent, changes));
            const resultString = result.get("docs.yml") ?? "";

            // Verify structure
            expect(resultString).toContain("tab: guides");
            expect(resultString).toContain("section 1");
            expect(resultString).toContain("section 1.1");
            expect(resultString).toContain("page 1");
            expect(resultString).toContain("page 1.1");

            const lines = resultString.split("\n");
            const tabIndex = lines.findIndex((line) => line.includes("tab: guides"));
            const section1Index = lines.findIndex((line) => line.includes("section: section 1"));
            const section11Index = lines.findIndex((line) => line.includes("section: section 1.1"));

            expect(section1Index).toBeGreaterThan(tabIndex);
            expect(section11Index).toBeGreaterThan(tabIndex);

            expect(section11Index).toBeGreaterThan(section1Index);
            const section1Indent = lines[section1Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            const section11Indent = lines[section11Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            expect(section11Indent).toBeGreaterThan(section1Indent);
        });

        it("should handle backward compatibility when parentSectionPathTitles is undefined", () => {
            const baseContent = `navigation: []`;

            const changes = new Map<string, NavigationChange>();

            // Create section without parentSectionPathTitles (old behavior)
            changes.set("pages/page-1.mdx", {
                type: "add_page",
                sectionTitle: "section 1",
                pageEntry: { page: "page 1", path: "pages/page-1.mdx" },
                insertionMode: "append",
                docsYmlFilePath: "docs.yml",
                createdAt: Date.now()
            });

            const result = buildDocsYmlContentFromChanges(createNavSnapshot(baseContent, changes));
            const resultString = result.get("docs.yml") ?? "";

            // Should create section at root level
            expect(resultString).toContain("section 1");
            expect(resultString).toContain("page 1");

            const lines = resultString.split("\n");
            const section1Index = lines.findIndex((line) => line.includes("section: section 1"));
            const section1Indent = lines[section1Index]?.match(/^(\s*)/)?.[1]?.length ?? 0;
            expect(section1Indent).toBeLessThanOrEqual(2); // Root level sections have minimal indent
        });
    });
});
