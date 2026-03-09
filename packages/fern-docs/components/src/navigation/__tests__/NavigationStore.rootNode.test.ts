import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { _createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";

const createTestRootNode = (): FernNavigation.RootNode => ({
    type: "root",
    id: "root" as FernNavigation.NodeId,
    collapsed: undefined,
    version: "v2",
    title: "Root",
    slug: "root" as FernNavigation.Slug,
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
        id: "unversioned" as FernNavigation.NodeId,
        collapsed: undefined,
        landingPage: undefined,
        child: {
            type: "sidebarRoot",
            id: "sidebar-root" as FernNavigation.NodeId,
            collapsed: undefined,
            children: [
                {
                    type: "section",
                    id: "test-section" as FernNavigation.NodeId,
                    title: "Test Section",
                    slug: "test-section" as FernNavigation.Slug,
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
                    children: []
                }
            ]
        }
    }
});

describe("NavigationStore - rootNode management", () => {
    let store: NavigationStore;

    beforeEach(async () => {
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({ storage: _createNavigationMemoryStorage() });
    });

    it("should store and retrieve rootNode", () => {
        const rootNode = createTestRootNode();

        store.setRootNode(rootNode);

        expect(store.rootNode).toEqual(rootNode);
    });

    it("should insert root-level page at end of container in YAML", async () => {
        // Create a navigation tree with:
        // - sidebarRoot
        //   - sidebarGroup (root-level container)
        //     - page: Introduction
        //   - apiReference: API Reference
        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            collapsed: undefined,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
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
                id: "unversioned" as FernNavigation.NodeId,
                collapsed: undefined,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: "sidebar-root" as FernNavigation.NodeId,
                    collapsed: undefined,
                    children: [
                        {
                            type: "sidebarGroup",
                            id: "sidebar-group-1" as FernNavigation.NodeId,
                            collapsed: undefined,
                            children: [
                                {
                                    type: "page",
                                    id: "intro-page-node" as FernNavigation.NodeId,
                                    collapsed: undefined,
                                    pageId: "pages/introduction.mdx" as FernNavigation.PageId,
                                    title: "Introduction",
                                    slug: "introduction" as FernNavigation.Slug,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    noindex: undefined,
                                    featureFlags: undefined,
                                    availability: undefined
                                }
                            ]
                        },
                        {
                            type: "apiReference",
                            id: "api-package-1" as FernNavigation.NodeId,
                            collapsed: undefined,
                            title: "API Reference",
                            slug: "api-reference" as FernNavigation.Slug,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            availability: undefined,
                            pointsTo: undefined,
                            children: [],
                            playground: undefined,
                            apiDefinitionId: "api-def-1" as FernNavigation.ApiDefinitionId,
                            overviewPageId: undefined,
                            noindex: undefined,
                            paginated: undefined,
                            showErrors: undefined,
                            hideTitle: undefined,
                            changelog: undefined,
                            postmanCollectionUrl: undefined
                        }
                    ]
                }
            }
        };

        const docsYmlContent = `navigation:
  - page: Introduction
    path: ./pages/introduction.mdx
  - api: API Reference
`;

        store.setRootNode(rootNode);
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            latestDocsYmlAndReferences: new Map([["docs.yml", docsYmlContent]])
        });

        // Create a new page at root level (in the sidebarGroup)
        const filename = "pages/new-page.mdx";
        const initialMdx = "---\ntitle: New Page\nslug: new-page\n---\n\n# New Page";

        const baseFoundNode: any = {
            type: "found",
            node: rootNode,
            parents: [],
            sidebar: rootNode.child.type === "unversioned" ? rootNode.child.child : undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: undefined,
            currentVariant: undefined,
            isCurrentVersionDefault: false,
            isCurrentProductDefault: false
        };

        // Target section path points to the sidebarGroup (root-level container)
        const targetSectionPath = [
            {
                id: "sidebar-root" as FernNavigation.NodeId,
                type: "sidebarRoot" as const,
                title: null
            },
            {
                id: "sidebar-group-1" as FernNavigation.NodeId,
                type: "sidebarGroup" as const,
                title: null
            }
        ];

        store.createClientPage(filename, {
            source: "client",
            filename,
            initialMdx,
            baseFoundNode,
            targetSectionPath
        });

        // Get the generated YAML
        const files = store.files;
        const docsYmlUpdated = files.changed["docs.yml"];

        expect(docsYmlUpdated).toBeDefined();
        expect(docsYmlUpdated).toContain("New Page");

        // The new page should appear at the end (after Introduction, before API Reference)
        const introIndex = docsYmlUpdated!.indexOf("Introduction");
        const newPageIndex = docsYmlUpdated!.indexOf("New Page");
        const apiRefIndex = docsYmlUpdated!.indexOf("API Reference");

        expect(introIndex).toBeLessThan(newPageIndex);
        expect(newPageIndex).toBeLessThan(apiRefIndex);
    });

    it("should insert root-level page at end when API ref is child of sidebarGroup", async () => {
        // When API Reference is a CHILD of the sidebarGroup (not a sibling),
        // new pages should be appended to the end, after the API reference
        const rootNode: FernNavigation.RootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            collapsed: undefined,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
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
                id: "unversioned" as FernNavigation.NodeId,
                collapsed: undefined,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: "sidebar-root" as FernNavigation.NodeId,
                    collapsed: undefined,
                    children: [
                        {
                            type: "sidebarGroup",
                            id: "sidebar-group-1" as FernNavigation.NodeId,
                            collapsed: undefined,
                            children: [
                                {
                                    type: "page",
                                    id: "intro-page-node" as FernNavigation.NodeId,
                                    collapsed: undefined,
                                    pageId: "pages/introduction.mdx" as FernNavigation.PageId,
                                    title: "Introduction",
                                    slug: "introduction" as FernNavigation.Slug,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    noindex: undefined,
                                    featureFlags: undefined,
                                    availability: undefined
                                },
                                {
                                    type: "apiReference",
                                    id: "api-package-1" as FernNavigation.NodeId,
                                    collapsed: undefined,
                                    title: "API Reference",
                                    slug: "api-reference" as FernNavigation.Slug,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    availability: undefined,
                                    pointsTo: undefined,
                                    children: [],
                                    playground: undefined,
                                    apiDefinitionId: "api-def-1" as FernNavigation.ApiDefinitionId,
                                    overviewPageId: undefined,
                                    noindex: undefined,
                                    paginated: undefined,
                                    showErrors: undefined,
                                    hideTitle: undefined,
                                    changelog: undefined,
                                    postmanCollectionUrl: undefined
                                }
                            ]
                        }
                    ]
                }
            }
        };

        const docsYmlContent = `navigation:
  - page: Introduction
    path: ./pages/introduction.mdx
  - api: API Reference
`;

        store.setRootNode(rootNode);
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            latestDocsYmlAndReferences: new Map([["docs.yml", docsYmlContent]])
        });

        // Create a new page at root level (in the sidebarGroup), which should go at the end
        const filename = "pages/new-page.mdx";
        const initialMdx = "---\ntitle: New Page\nslug: new-page\n---\n\n# New Page";

        const baseFoundNode: any = {
            type: "found",
            node: rootNode,
            parents: [],
            sidebar: rootNode.child.type === "unversioned" ? rootNode.child.child : undefined,
            tabs: [],
            currentTab: undefined,
            currentVersion: undefined,
            currentProduct: undefined,
            currentVariant: undefined,
            isCurrentVersionDefault: false,
            isCurrentProductDefault: false
        };

        const targetSectionPath = [
            {
                id: "sidebar-root" as FernNavigation.NodeId,
                type: "sidebarRoot" as const,
                title: null
            },
            {
                id: "sidebar-group-1" as FernNavigation.NodeId,
                type: "sidebarGroup" as const,
                title: null
            }
        ];

        store.createClientPage(filename, {
            source: "client",
            filename,
            initialMdx,
            baseFoundNode,
            targetSectionPath
        });

        // Get the generated YAML
        const files = store.files;
        const docsYmlUpdated = files.changed["docs.yml"];

        expect(docsYmlUpdated).toBeDefined();
        expect(docsYmlUpdated).toContain("New Page");

        // The new page should appear at the end (after Introduction and API Reference)
        const introIndex = docsYmlUpdated!.indexOf("Introduction");
        const apiRefIndex = docsYmlUpdated!.indexOf("API Reference");
        const newPageIndex = docsYmlUpdated!.indexOf("New Page");

        expect(introIndex).toBeLessThan(apiRefIndex);
        expect(apiRefIndex).toBeLessThan(newPageIndex);
    });

    it("should persist rootNode in snapshot", () => {
        const rootNode = createTestRootNode();

        store.setRootNode(rootNode);

        const snapshot = store.getSnapshot();
        expect(snapshot.rootNode).toEqual(rootNode);
    });

    it("should update rootNode when renaming section", () => {
        const rootNode = createTestRootNode();
        store.setRootNode(rootNode);

        store.renameSection("test-section" as FernNavigation.NodeId, "Renamed Section");

        expect(store.rootNode).toBeDefined();
        // Navigate to section in the tree to verify rename
        const unversioned = store.rootNode?.child as FernNavigation.UnversionedNode;
        const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
        const section = sidebarRoot.children[0] as FernNavigation.SectionNode;
        expect(section.title).toBe("Renamed Section");
    });

    it("should inject client page into rootNode", () => {
        const rootNode = createTestRootNode();
        store.setRootNode(rootNode);

        const filename = "test-page.mdx";
        const initialMdx = "---\ntitle: Test Page\nslug: test-page\n---\n\n# Test Page";

        store.createClientPage(filename, {
            source: "client",
            filename,
            initialMdx,
            baseFoundNode: {
                type: "found",
                node: {
                    type: "page",
                    id: "base-page" as FernNavigation.NodeId,
                    collapsed: undefined,
                    title: "Base Page",
                    slug: "base-page" as FernNavigation.Slug,
                    pageId: "base-page" as FernNavigation.PageId,
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
                parents: [],
                sidebar: undefined,
                tabs: [],
                currentTab: undefined,
                currentVersion: undefined,
                currentProduct: undefined,
                currentVariant: undefined,
                isCurrentVersionDefault: true,
                isCurrentProductDefault: true
            },
            targetSectionPath: [
                {
                    id: "test-section" as FernNavigation.NodeId,
                    type: "section",
                    title: "Test Section"
                }
            ]
        });

        expect(store.rootNode).toBeDefined();
        const unversioned = store.rootNode?.child as FernNavigation.UnversionedNode;
        const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
        const section = sidebarRoot.children[0] as FernNavigation.SectionNode;

        // Verify the page was injected into the section
        expect(section.children).toHaveLength(1);
        expect(section.children[0]?.type).toBe("page");
        expect((section.children[0] as FernNavigation.PageNode).title).toBe("Test Page");
    });

    it("should handle section rename propagating to add_page changes", async () => {
        // Hydrate with minimal docs.yml content
        await store.hydrate({
            latestDocsYmlAndReferences: new Map([
                [
                    "docs.yml",
                    `
navigation:
  - section: Test Section
    contents: []
`
                ]
            ])
        });

        const rootNode = createTestRootNode();
        store.setRootNode(rootNode);

        const filename = "test-page.mdx";
        const initialMdx = "---\ntitle: Test Page\nslug: test-page\n---\n\n# Test Page";

        // Create a page in the section
        store.createClientPage(filename, {
            source: "client",
            filename,
            initialMdx,
            baseFoundNode: {
                type: "found",
                node: {
                    type: "page",
                    id: "base-page" as FernNavigation.NodeId,
                    collapsed: undefined,
                    title: "Base Page",
                    slug: "base-page" as FernNavigation.Slug,
                    pageId: "base-page" as FernNavigation.PageId,
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
                parents: [],
                sidebar: undefined,
                tabs: [],
                currentTab: undefined,
                currentVersion: undefined,
                currentProduct: undefined,
                currentVariant: undefined,
                isCurrentVersionDefault: true,
                isCurrentProductDefault: true
            },
            targetSectionPath: [
                {
                    id: "test-section" as FernNavigation.NodeId,
                    type: "section",
                    title: "Test Section"
                }
            ]
        });

        const snapshot1 = store.getSnapshot();
        const change1 = snapshot1.navigationChanges.get(filename);
        expect(change1?.type).toBe("add_page");
        // sectionTitle is kept for backwards compatibility, but sectionId is the source of truth
        expect(change1?.type === "add_page" && change1.sectionId).toBe("test-section");

        // Rename the section
        store.renameSection("test-section" as FernNavigation.NodeId, "Renamed Section");

        const snapshot2 = store.getSnapshot();
        const change2 = snapshot2.navigationChanges.get(filename);
        expect(change2?.type).toBe("add_page");
        // The sectionId should remain the same (stable identifier)
        expect(change2?.type === "add_page" && change2.sectionId).toBe("test-section");

        // What matters is that the YAML generation uses the current section title
        const files = store.files;
        expect(files.changed["docs.yml"]).toBeDefined();
        expect(files.changed["docs.yml"]).toContain("Renamed Section");
        expect(files.changed["docs.yml"]).toContain("Test Page");
    });

    it("should collapse multiple consecutive section renames into a single change", () => {
        const rootNode = createTestRootNode();
        store.setRootNode(rootNode);

        // Rename the section multiple times
        store.renameSection("test-section" as FernNavigation.NodeId, "First Rename");
        store.renameSection("test-section" as FernNavigation.NodeId, "Second Rename");
        store.renameSection("test-section" as FernNavigation.NodeId, "Third Rename");

        const snapshot = store.getSnapshot();
        const renameChange = snapshot.navigationChanges.get("section-rename-test-section");

        // Should have a single rename change with original oldTitle and final newTitle
        expect(renameChange?.type).toBe("rename_section");
        expect(renameChange?.type === "rename_section" && renameChange.oldTitle).toBe("Test Section");
        expect(renameChange?.type === "rename_section" && renameChange.newTitle).toBe("Third Rename");
    });

    it("should maintain correct order for pages added to section", () => {
        const rootNode = createTestRootNode();
        store.setRootNode(rootNode);

        // Create first page
        const filename1 = "page-1.mdx";
        const initialMdx1 = "---\ntitle: Page 1\nslug: page-1\n---\n\n# Page 1";

        store.createClientPage(filename1, {
            source: "client",
            filename: filename1,
            initialMdx: initialMdx1,
            baseFoundNode: {
                type: "found",
                node: {} as any,
                parents: [],
                sidebar: undefined,
                tabs: [],
                currentTab: undefined,
                currentVersion: undefined,
                currentProduct: undefined,
                currentVariant: undefined,
                isCurrentVersionDefault: true,
                isCurrentProductDefault: true
            },
            targetSectionPath: [
                {
                    id: "test-section" as FernNavigation.NodeId,
                    type: "section",
                    title: "Test Section"
                }
            ]
        });

        // Create second page
        const filename2 = "page-2.mdx";
        const initialMdx2 = "---\ntitle: Page 2\nslug: page-2\n---\n\n# Page 2";

        store.createClientPage(filename2, {
            source: "client",
            filename: filename2,
            initialMdx: initialMdx2,
            baseFoundNode: {
                type: "found",
                node: {} as any,
                parents: [],
                sidebar: undefined,
                tabs: [],
                currentTab: undefined,
                currentVersion: undefined,
                currentProduct: undefined,
                currentVariant: undefined,
                isCurrentVersionDefault: true,
                isCurrentProductDefault: true
            },
            targetSectionPath: [
                {
                    id: "test-section" as FernNavigation.NodeId,
                    type: "section",
                    title: "Test Section"
                }
            ]
        });

        const snapshot = store.getSnapshot();
        const change1 = snapshot.navigationChanges.get(filename1);
        const change2 = snapshot.navigationChanges.get(filename2);

        // Both should be tracked as add_page changes
        expect(change1?.type).toBe("add_page");
        expect(change2?.type).toBe("add_page");

        // Verify both pages are in RootNode in correct order
        const unversioned = store.rootNode?.child as FernNavigation.UnversionedNode;
        const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
        const section = sidebarRoot.children[0] as FernNavigation.SectionNode;

        expect(section.children).toHaveLength(2);
        expect((section.children[0] as FernNavigation.PageNode).title).toBe("Page 1");
        expect((section.children[1] as FernNavigation.PageNode).title).toBe("Page 2");
    });

    it("should correctly determine docsYmlFilePath for server pages in products when marking for deletion", async () => {
        // Create a multi-product root node
        // Using 'as any' to bypass type checking for product-related node types
        const productRootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            collapsed: undefined,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
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
                id: "unversioned" as FernNavigation.NodeId,
                collapsed: undefined,
                landingPage: undefined,
                child: {
                    type: "productgroup" as any,
                    id: "productgroup" as FernNavigation.NodeId,
                    collapsed: undefined,
                    landingPage: undefined,
                    children: [
                        {
                            type: "product" as any,
                            id: "product-a" as FernNavigation.NodeId,
                            collapsed: undefined,
                            title: "Product A",
                            slug: "product-a" as FernNavigation.Slug,
                            version: undefined,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            pointsTo: undefined,
                            featureFlags: undefined,
                            child: {
                                type: "unversioned" as any,
                                id: "product-a-unversioned" as FernNavigation.NodeId,
                                collapsed: undefined,
                                child: {
                                    type: "sidebarRoot",
                                    id: "product-a-sidebar" as FernNavigation.NodeId,
                                    collapsed: undefined,
                                    children: [
                                        {
                                            type: "page",
                                            id: "product-a-page" as FernNavigation.NodeId,
                                            collapsed: undefined,
                                            pageId: "product-a-page.mdx" as FernNavigation.PageId,
                                            title: "Product A Page",
                                            slug: "product-a-page" as FernNavigation.Slug,
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
                            }
                        }
                    ]
                }
            }
        } as any as FernNavigation.RootNode;

        // Create a new store with the multi-product structure and slug map
        const productStore = new NavigationStore("test-branch", "test-org", "https://test.com");

        await productStore.hydrate({
            storage: _createNavigationMemoryStorage(),
            latestDocsYmlAndReferences: new Map([
                [
                    "docs.yml",
                    `products:
  - id: product-a
    slug: product-a
    path: product-a/docs.yml
navigation:
  - page: Root Page
    path: root.mdx`
                ],
                ["product-a/docs.yml", "navigation:\n  - page: Product A Page\n    path: product-a-page.mdx"]
            ])
        });

        productStore.setRootNode(productRootNode);

        // Mark a server page for deletion (not in registry)
        const filename = "product-a-page.mdx";
        productStore.markPageForDeletion(filename, "Product A Page");

        // Verify the change was tracked with the correct yml file path
        const snapshot = productStore.getSnapshot();
        const change = snapshot.navigationChanges.get(filename);

        expect(change?.type).toBe("remove_page");
        expect(change?.type === "remove_page" && change.docsYmlFilePath).toBe("product-a/docs.yml");

        // Verify that the yml file is actually modified
        const files = productStore.files;
        console.log("[Test] Changed files:", Object.keys(files.changed));
        console.log("[Test] product-a/docs.yml content:", files.changed["product-a/docs.yml"]);

        // The page should be removed from the product yml file
        expect(files.changed["product-a/docs.yml"]).toBeDefined();
        expect(files.changed["product-a/docs.yml"]).not.toContain("product-a-page.mdx");
    });

    it("should preserve yml changes after commit (full dashboard flow)", async () => {
        // Setup: Create a multi-product root node with a page to delete
        const productRootNode = {
            type: "root",
            id: "root" as FernNavigation.NodeId,
            collapsed: undefined,
            version: "v2",
            title: "Root",
            slug: "root" as FernNavigation.Slug,
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
                id: "unversioned" as FernNavigation.NodeId,
                collapsed: undefined,
                landingPage: undefined,
                child: {
                    type: "productgroup" as any,
                    id: "productgroup" as FernNavigation.NodeId,
                    collapsed: undefined,
                    landingPage: undefined,
                    children: [
                        {
                            type: "product" as any,
                            id: "product-a" as FernNavigation.NodeId,
                            collapsed: undefined,
                            title: "Product A",
                            slug: "product-a" as FernNavigation.Slug,
                            version: undefined,
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            pointsTo: undefined,
                            featureFlags: undefined,
                            child: {
                                type: "unversioned" as any,
                                id: "product-a-unversioned" as FernNavigation.NodeId,
                                collapsed: undefined,
                                child: {
                                    type: "sidebarRoot",
                                    id: "product-a-sidebar" as FernNavigation.NodeId,
                                    collapsed: undefined,
                                    children: [
                                        {
                                            type: "page",
                                            id: "product-a-page" as FernNavigation.NodeId,
                                            collapsed: undefined,
                                            pageId: "product-a-page.mdx" as FernNavigation.PageId,
                                            title: "Product A Page",
                                            slug: "product-a-page" as FernNavigation.Slug,
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
                            }
                        }
                    ]
                }
            }
        } as any as FernNavigation.RootNode;

        const productStore = new NavigationStore("test-branch", "test-org", "https://test.com");

        // Step 1: Hydrate with initial yml content (simulates page load)
        const initialYmlContent = new Map([
            [
                "docs.yml",
                `products:
  - id: product-a
    slug: product-a
    path: product-a/docs.yml
navigation:
  - page: Root Page
    path: root.mdx`
            ],
            ["product-a/docs.yml", "navigation:\n  - page: Product A Page\n    path: product-a-page.mdx"]
        ]);

        await productStore.hydrate({
            storage: _createNavigationMemoryStorage(),
            latestDocsYmlAndReferences: initialYmlContent
        });

        productStore.setRootNode(productRootNode);

        // Step 2: Delete a page (simulates user clicking delete)
        const filename = "product-a-page.mdx";
        productStore.markPageForDeletion(filename, "Product A Page");

        // Step 3: Get files for commit (simulates CommitButton getting files)
        const filesBeforeCommit = productStore.files;
        console.log("[Test] Files to commit:", Object.keys(filesBeforeCommit.changed));
        console.log("[Test] product-a/docs.yml before commit:", filesBeforeCommit.changed["product-a/docs.yml"]);

        // Verify the yml file has the page removed BEFORE commit
        expect(filesBeforeCommit.changed["product-a/docs.yml"]).toBeDefined();
        expect(filesBeforeCommit.changed["product-a/docs.yml"]).not.toContain("product-a-page.mdx");

        // Step 4: Simulate successful commit (simulates CommitButton calling handleCommitSuccess)
        productStore.handleCommitSuccess();

        // Step 5: Check the yml content in the store's Map AFTER commit
        const snapshot = productStore.getSnapshot();
        console.log(
            "[Test] docsYmlBaseContent keys after commit:",
            snapshot.docsYmlBaseContent ? Array.from(snapshot.docsYmlBaseContent.keys()) : "null"
        );

        if (snapshot.docsYmlBaseContent) {
            const productYmlAfterCommit = snapshot.docsYmlBaseContent.get("product-a/docs.yml");
            console.log("[Test] product-a/docs.yml content after commit:", productYmlAfterCommit);

            // CRITICAL: The yml Map should have the updated content (without the deleted page)
            expect(productYmlAfterCommit).toBeDefined();
            expect(productYmlAfterCommit).not.toContain("product-a-page.mdx");
            expect(productYmlAfterCommit).toContain("navigation:");
        } else {
            throw new Error("docsYmlBaseContent is null after commit");
        }

        // Step 6: Simulate getting files again after commit (simulates next interaction)
        const filesAfterCommit = productStore.files;
        console.log("[Test] Files after commit:", Object.keys(filesAfterCommit.changed));

        // After commit, there should be no uncommitted changes
        expect(filesAfterCommit.hasChangesToCommit).toBe(false);
    });
});
