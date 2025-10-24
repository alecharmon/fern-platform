import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { _createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";

const createTestRootNode = (): FernNavigation.RootNode => ({
    type: "root",
    id: "root" as FernNavigation.NodeId,
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
        landingPage: undefined,
        child: {
            type: "sidebarRoot",
            id: "sidebar-root" as FernNavigation.NodeId,
            children: [
                {
                    type: "section",
                    id: "test-section" as FernNavigation.NodeId,
                    title: "Test Section",
                    slug: "test-section" as FernNavigation.Slug,
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

    it("should handle section rename propagating to add_page changes", () => {
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
        const change1 = snapshot1.docsYmlChanges.get(filename);
        expect(change1?.type).toBe("add_page");
        expect(change1?.type === "add_page" && change1.sectionTitle).toBe("Test Section");

        // Rename the section
        store.renameSection("test-section" as FernNavigation.NodeId, "Renamed Section");

        const snapshot2 = store.getSnapshot();
        const change2 = snapshot2.docsYmlChanges.get(filename);
        expect(change2?.type).toBe("add_page");
        expect(change2?.type === "add_page" && change2.sectionTitle).toBe("Renamed Section");
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
        const change1 = snapshot.docsYmlChanges.get(filename1);
        const change2 = snapshot.docsYmlChanges.get(filename2);

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
});
