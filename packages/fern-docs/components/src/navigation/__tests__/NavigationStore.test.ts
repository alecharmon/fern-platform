import { beforeEach, describe, expect, it } from "vitest";

import type { FernNavigation } from "@fern-api/fdr-sdk";

import { createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";

const createTestPageData = () => ({
    html: "<p>Test</p>",
    frontmatter: { title: "Test" }
});

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
        store = new NavigationStore("test-branch", "test-org", "https://test.com", createNavigationMemoryStorage());
    });

    describe("page data persistence", () => {
        it("should save and retrieve page data", () => {
            const pageData = { "test.mdx": createTestPageData() };

            store.savePageData(pageData);

            const retrieved = store.loadPageData("test.mdx");
            expect(retrieved).toEqual({
                ...pageData["test.mdx"],
                lastModified: expect.any(Number),
                pageType: "server"
            });
        });
    });

    describe("commit success handling", () => {
        it("should track committed files after success", () => {
            const allFilesToCommit = {
                "test.mdx": "# Test Content",
                "docs.yml": "navigation: []"
            };

            store.handleCommitSuccess(allFilesToCommit);

            const committedFiles = store.getCommittedFiles();
            expect(committedFiles.has("test.mdx")).toBe(true);
        });
    });

    describe("client pages", () => {
        it("should create, update, and retrieve client pages", () => {
            const testNode = createTestNode();
            const pageData = createTestPageData();
            const parentId = "parent-id" as FernNavigation.NodeId;

            store.createPage(parentId, testNode);
            expect(store.loadClientNodes()[parentId]).toEqual([testNode]);

            store.updatePage(testNode.id, pageData);
            expect(store.loadClientFoundNodes()[testNode.id]).toBeDefined();
        });
    });
});
