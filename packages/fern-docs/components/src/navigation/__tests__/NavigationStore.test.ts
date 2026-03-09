import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import { _createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";

const createTestNode = (id = "test-id", title = "Test Page"): FernNavigation.PageNode => ({
    id: id as FernNavigation.NodeId,
    collapsed: undefined,
    type: "page" as const,
    title,
    slug: title.toLowerCase().replace(" ", "-") as FernNavigation.Slug,
    pageId: id as FernNavigation.PageId,
    availability: undefined,
    canonicalSlug: undefined,
    icon: undefined,
    hidden: undefined,
    authed: undefined,
    viewers: undefined,
    orphaned: undefined,
    featureFlags: undefined,
    noindex: undefined
});

describe("NavigationStore", () => {
    let store: NavigationStore;

    beforeEach(async () => {
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({ storage: _createNavigationMemoryStorage() });
    });

    describe("page data persistence", () => {
        it("should update and retrieve page data", () => {
            const testNode = createTestNode();
            const filename = "test.mdx";

            // First register a page
            store.registerPage({
                source: "server",
                filename,
                mdx: "# Test",
                html: "<h1>Test</h1>",
                frontmatter: { title: "Test" },
                foundNode: {
                    type: "found",
                    node: testNode,
                    parents: [],
                    sidebar: undefined,
                    tabs: [],
                    currentTab: undefined,
                    currentVersion: undefined,
                    currentProduct: undefined,
                    currentVariant: undefined,
                    isCurrentVersionDefault: true,
                    isCurrentProductDefault: true
                }
            });

            // Update the page
            store.updatePage(filename, { mdx: "# Updated Test" });

            const retrieved = store.registeredPages[filename]?.pageData;
            expect(retrieved?.mdx).toBe("# Updated Test");
            expect(retrieved?.filename).toBe(filename);
        });
    });

    describe("commit success handling", () => {
        it("should mark files as committed after success", () => {
            const testNode = createTestNode();
            const filename = "test.mdx";

            // Create and register a page
            store.registerPage({
                source: "client",
                filename,
                mdx: "# Test Content",
                html: "<h1>Test Content</h1>",
                frontmatter: { title: "Test" },
                foundNode: {
                    type: "found",
                    node: testNode,
                    parents: [],
                    sidebar: undefined,
                    tabs: [],
                    currentTab: undefined,
                    currentVersion: undefined,
                    currentProduct: undefined,
                    currentVariant: undefined,
                    isCurrentVersionDefault: true,
                    isCurrentProductDefault: true
                }
            });

            // Mark it as changed
            store.updatePage(filename, { mdx: "# Updated Content" });

            // Verify it's in changed files
            const changedFiles = store.files.changed;
            expect(changedFiles[filename]).toBeTruthy();

            // Commit
            store.handleCommitSuccess();

            // Verify it's marked as committed
            const entry = store.registeredPages[filename];
            expect(entry?.status).toBe("committed");
        });
    });

    describe("client pages", () => {
        it("should create, update, and retrieve client pages", () => {
            const filename = "test-page.mdx";
            const initialMdx = "---\ntitle: Test Page\nslug: test-page\n---\n\n# Test Page";

            // Create a client page
            store.createClientPage(filename, {
                source: "client",
                filename,
                initialMdx,
                baseFoundNode: {
                    type: "found",
                    node: createTestNode(),
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
                targetSectionPath: []
            });

            // Verify page was created
            const page = store.registeredPages[filename]?.pageData;
            expect(page).toBeDefined();
            expect(page?.filename).toBe(filename);
            expect(page?.source).toBe("client");

            // Update the page
            store.updatePage(filename, { mdx: "# Updated" });

            // Verify update
            const updated = store.registeredPages[filename]?.pageData;
            expect(updated?.mdx).toBe("# Updated");
        });
    });

    describe("rootNode handling", () => {
        it("should handle empty rootNode gracefully", () => {
            expect(store.rootNode).toBeUndefined();

            // Operations should not crash when rootNode is empty
            expect(() => store.renameSection("section-id" as FernNavigation.NodeId, "New Title")).not.toThrow();
        });

        it("should persist rootNode in snapshot", () => {
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
                    type: "versioned",
                    id: "versioned" as FernNavigation.NodeId,
                    collapsed: undefined,
                    children: []
                }
            };

            store.setRootNode(rootNode);
            expect(store.rootNode).toEqual(rootNode);

            const snapshot = store.getSnapshot();
            expect(snapshot.rootNode).toEqual(rootNode);
        });
    });

    describe("file tracking", () => {
        it("should track changed pages", () => {
            const testNode = createTestNode();
            const filename = "test.mdx";

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Test",
                html: "<h1>Test</h1>",
                frontmatter: { title: "Test" },
                foundNode: {
                    type: "found",
                    node: testNode,
                    parents: [],
                    sidebar: undefined,
                    tabs: [],
                    currentTab: undefined,
                    currentVersion: undefined,
                    currentProduct: undefined,
                    currentVariant: undefined,
                    isCurrentVersionDefault: true,
                    isCurrentProductDefault: true
                }
            });

            expect(store.files.hasChangesToCommit).toBe(false);

            store.updatePage(filename, { mdx: "# Updated" });
            expect(store.files.hasChangesToCommit).toBe(true);
            expect(store.files.changed[filename]).toBe("# Updated");
        });

        it("should track deleted pages", () => {
            const testNode = createTestNode();
            const filename = "test.mdx";

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Test",
                html: "<h1>Test</h1>",
                frontmatter: { title: "Test" },
                foundNode: {
                    type: "found",
                    node: testNode,
                    parents: [],
                    sidebar: undefined,
                    tabs: [],
                    currentTab: undefined,
                    currentVersion: undefined,
                    currentProduct: undefined,
                    currentVariant: undefined,
                    isCurrentVersionDefault: true,
                    isCurrentProductDefault: true
                }
            });

            store.markPageForDeletion(filename);
            expect(store.files.deleted).toContain(filename);
        });
    });
});
