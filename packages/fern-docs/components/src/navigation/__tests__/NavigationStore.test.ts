import { beforeEach, describe, expect, it } from "vitest";

import type { FernNavigation } from "@fern-api/fdr-sdk";

import { createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";

const createTestNode = (id = "test-id", title = "Test Page"): FernNavigation.PageNode => ({
    id: id as FernNavigation.NodeId,
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

    beforeEach(() => {
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        store.hydrate({ storage: createNavigationMemoryStorage() });
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
});
