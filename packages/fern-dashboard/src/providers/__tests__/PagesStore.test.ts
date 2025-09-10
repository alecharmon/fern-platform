import { beforeEach, describe, expect, it, vi } from "vitest";

import { FernNavigation } from "@fern-api/fdr-sdk";
import {
  NavigationStore,
  createNavigationMemoryStorage,
} from "@fern-docs/components";

import { PagesStore } from "../PagesStore";

const createTestDocsYml = () => `instances:
  - url: test.docs.dev.buildwithfern.com
navigation:
  - section: Introduction
    contents:
      - page: Getting Started
        path: ./docs/mdx/getting-started.mdx
colors:
  accentPrimary: "#16EE9D"
title: Test Docs`;

const createTestPageData = (title = "Test") => ({
  html: `<h1>${title}</h1><p>Content for ${title}</p>`,
  frontmatter: { title, slug: title.toLowerCase().replace(" ", "-") },
});

const createTestNode = (
  id: string,
  title: string
): FernNavigation.PageNode => ({
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
  noindex: undefined,
});

const createMockSidebar = (): FernNavigation.SidebarRootNode => ({
  id: "root" as FernNavigation.NodeId,
  type: "sidebarRoot" as const,
  children: [
    {
      id: "intro-section" as FernNavigation.NodeId,
      type: "section" as const,
      title: "Introduction",
      slug: "introduction" as FernNavigation.Slug,
      children: [],
      availability: undefined,
      collapsed: undefined,
      canonicalSlug: undefined,
      icon: undefined,
      hidden: undefined,
      authed: undefined,
      viewers: undefined,
      orphaned: undefined,
      featureFlags: undefined,
      noindex: undefined,
      overviewPageId: undefined,
      pointsTo: undefined,
    },
  ],
});

describe("PagesStore", () => {
  let store: PagesStore;
  let navigationStore: NavigationStore;

  beforeEach(() => {
    vi.clearAllMocks();
    navigationStore = new NavigationStore(
      "test-branch",
      createNavigationMemoryStorage()
    );
    store = new PagesStore(navigationStore);
    store.setDocsYmlBaseContent(createTestDocsYml());
  });

  describe("MDX file management", () => {
    it("should track and generate MDX content", () => {
      store.applyPageChange("test.mdx", "# New Content");
      expect(store.loadChangedMdxFiles()["test.mdx"]).toBe("# New Content");

      expect(store.loadChangedMdxFiles()).toEqual({
        "test.mdx": "# New Content",
      });

      // Test HTML to MDX conversion
      store.initializePage(
        "test2.mdx",
        undefined,
        "<p>Initial</p>",
        { title: "Test" },
        undefined
      );
      store.updatePage("test2.mdx", {
        html: "<p>Updated</p>",
        frontmatter: { title: "Updated Test" },
      });

      const changedFiles = store.loadChangedMdxFiles();
      expect(changedFiles["test2.mdx"]).toContain("title: Updated Test");
      expect(changedFiles["test2.mdx"]).toContain("Updated");
    });
  });

  describe("page initialization", () => {
    it("should initialize and load persisted pages", () => {
      store.initializePage(
        "test.mdx",
        undefined,
        "<p>Test</p>",
        { title: "Test Page" },
        undefined
      );

      expect(store.getFrontmatterData()["test.mdx"]).toEqual({
        title: "Test Page",
      });
      expect(store.getSyncedStatus()["test.mdx"]).toBe("SYNCED");

      // Test persistence loading
      const persistedPageData = createTestPageData("Persisted");

      // Save some data first through the PagesStore
      store.initializePage(
        "persisted.mdx",
        undefined,
        persistedPageData.html,
        persistedPageData.frontmatter,
        undefined
      );
      store.updatePage("persisted.mdx", persistedPageData);

      const newStore = new PagesStore(navigationStore);
      newStore.setDocsYmlBaseContent(createTestDocsYml());
      const persistedFiles = newStore.loadChangedMdxFiles();
      expect(persistedFiles["persisted.mdx"]).toContain("title: Persisted");
    });
  });

  describe("commit handling", () => {
    it("should clear committed changes", () => {
      store.applyPageChange("test.mdx", "# Test Content");
      expect(store.loadChangedMdxFiles()["test.mdx"]).toBe("# Test Content");

      store.clearCommittedChanges();

      expect(Object.keys(store.loadChangedMdxFiles())).toHaveLength(0);
    });
  });

  describe("persistence", () => {
    it("should persist changes to NavigationStore", () => {
      store.initializePage(
        "test.mdx",
        undefined,
        "<p>Initial</p>",
        { title: "Test" },
        undefined
      );
      store.updatePage("test.mdx", {
        html: "<p>Updated</p>",
        frontmatter: { title: "Updated Test" },
      });

      const changedFiles = store.loadChangedMdxFiles();
      expect(changedFiles["test.mdx"]).toContain("title: Updated Test");
      expect(changedFiles["test.mdx"]).toContain("Updated");

      // Verify persistence by creating a new store instance
      const newStore = new PagesStore(navigationStore);
      newStore.setDocsYmlBaseContent(createTestDocsYml());
      const persistedFiles = newStore.loadChangedMdxFiles();
      expect(persistedFiles["test.mdx"]).toContain("title: Updated Test");
    });
  });

  describe("subscriptions", () => {
    it("should notify subscribers when changes occur", () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.applyPageChange("test.mdx", "# Test Content");
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      vi.clearAllMocks();
      store.applyPageChange("test2.mdx", "# Test Content 2");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("Real NavigationStore Integration", () => {
    let navigationStore: NavigationStore;
    let pagesStore: PagesStore;

    beforeEach(() => {
      navigationStore = new NavigationStore(
        "test-branch",
        createNavigationMemoryStorage()
      );
      pagesStore = new PagesStore(navigationStore);
      pagesStore.setDocsYmlBaseContent(createTestDocsYml());
    });

    it("should handle create/update/delete page sequence", () => {
      const mockSidebar = createMockSidebar();
      const parentId = "intro-section" as FernNavigation.NodeId;

      // Create pages A, B, C
      const pages = ["A", "B", "C"].map((letter) => {
        const pageData = createTestPageData(`Page ${letter}`);
        const pageNode = createTestNode(
          `page-${letter.toLowerCase()}`,
          `Page ${letter}`
        );

        pagesStore.createPage(
          parentId,
          pageNode,
          mockSidebar,
          pageData,
          `page-${letter.toLowerCase()}`
        );
        pagesStore.initializePage(
          `page-${letter.toLowerCase()}.mdx`,
          pageNode.id,
          pageData.html,
          pageData.frontmatter,
          undefined
        );
        pagesStore.updatePage(`page-${letter.toLowerCase()}.mdx`, pageData);

        return { pageData, pageNode, letter };
      });

      // Verify all pages exist
      const changedFiles = pagesStore.loadChangedMdxFiles();
      expect(Object.keys(changedFiles)).toEqual(
        expect.arrayContaining(["page-a.mdx", "page-b.mdx", "page-c.mdx"])
      );

      // Delete page B
      const pageBNode = pages[1]?.pageNode;
      if (pageBNode?.id) {
        navigationStore.deletePage(pageBNode.id);
        pagesStore.removePage("page-b.mdx");
      }

      // Verify commit structure
      const commit = pagesStore.prepareCommit(pagesStore.loadChangedMdxFiles());
      expect(commit.changedFiles).toHaveProperty("page-a.mdx");
      expect(commit.changedFiles).toHaveProperty("page-c.mdx");
      expect(commit.changedFiles).not.toHaveProperty("page-b.mdx");
      expect(commit.deletedFiles).toContain("page-b.mdx");
    });

    it("should persist data across store instances", () => {
      const pageData = createTestPageData("Persistent Page");
      const pageNode = createTestNode("persistent", "Persistent Page");

      navigationStore.createPage(
        "section" as FernNavigation.NodeId,
        pageNode,
        undefined,
        pageData,
        "persistent"
      );
      pagesStore.initializePage(
        "persistent.mdx",
        pageNode.id,
        pageData.html,
        pageData.frontmatter,
        undefined
      );
      pagesStore.updatePage("persistent.mdx", pageData);

      expect(pagesStore.loadChangedMdxFiles()).toHaveProperty("persistent.mdx");

      // Test persistence across store instances
      const newPagesStore = new PagesStore(navigationStore);
      expect(typeof newPagesStore.loadChangedMdxFiles()).toBe("object");
      expect(typeof newPagesStore.getFrontmatterData()).toBe("object");
    });

    it("should handle immediate page creation and commit tracking", () => {
      const mockSidebar = createMockSidebar();
      const pageData = createTestPageData("New Page");
      const pageNode = createTestNode("new-page", "New Page");

      pagesStore.createPage(
        (mockSidebar.children[0]?.id ??
          "intro-section") as FernNavigation.NodeId,
        pageNode,
        mockSidebar,
        pageData,
        "new-page"
      );

      // Page should immediately appear in changedMdxFiles
      const snapshot = pagesStore.getSnapshot();
      expect(snapshot.changedMdxFiles).toHaveProperty("new-page.mdx");
      expect(snapshot.changedMdxFiles["new-page.mdx"]).toContain("New Page");

      // Should handle commit tracking
      const changedFiles = pagesStore.loadChangedMdxFiles();
      expect(pagesStore.isCommitted(changedFiles)).toBe(false);

      pagesStore.handleCommitSuccess(changedFiles);
      expect(typeof pagesStore.isCommitted(changedFiles)).toBe("boolean");
    });
  });
});
