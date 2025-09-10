import { beforeEach, describe, expect, it } from "vitest";

import { FernNavigation } from "@fern-api/fdr-sdk";

import {
  NavigationStorage,
  createNavigationMemoryStorage,
} from "../NavigationStorage";

const createTestNode = (): FernNavigation.PageNode => ({
  id: "test-page" as FernNavigation.NodeId,
  type: "page" as const,
  title: "Test Page",
  slug: "test-page" as FernNavigation.Slug,
  pageId: "test-page" as FernNavigation.PageId,
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

const createTestData = () => ({
  clientPages: {},
  docsYmlState: {
    baseContent: "",
    pendingUpdates: {},
    lastFetched: 0,
  },
  committedFiles: new Set<string>(["test.mdx"]),
  pageContents: {},
  lastCommittedHash: undefined,
});

describe("NavigationStorage", () => {
  let storage: NavigationStorage;

  beforeEach(() => {
    storage = createNavigationMemoryStorage();
  });

  it("should store, retrieve, and handle Set serialization", () => {
    const testData = createTestData();

    storage.setStore("test-branch", testData);
    const retrieved = storage.getStore("test-branch");

    expect(retrieved.docsYmlState.baseContent).toBe("");
    expect(retrieved.committedFiles).toEqual(new Set(["test.mdx"]));
    expect(retrieved.committedFiles.has("test.mdx")).toBe(true);
  });

  it("should return empty store for non-existent branch", () => {
    const result = storage.getStore("non-existent-branch");

    expect(result.clientPages).toEqual({});
    expect(result.committedFiles).toEqual(new Set());
    expect(result.pageContents).toEqual({});
  });

  it("should update existing store data", () => {
    storage.setStore("test-branch", createTestData());

    storage.updateStore("test-branch", {
      docsYmlState: {
        baseContent: "updated",
        pendingUpdates: {},
        lastFetched: 100,
      },
    });

    const result = storage.getStore("test-branch");
    expect(result.docsYmlState.baseContent).toBe("updated");
    expect(result.docsYmlState.lastFetched).toBe(100);
  });

  it("should handle client pages data", () => {
    const testData = {
      ...createTestData(),
      clientPages: {
        "test-page": {
          node: createTestNode(),
          parentNodeId: "parent-id" as FernNavigation.NodeId,
          createdAt: Date.now(),
          fullSlug: "test",
        },
      },
    };

    storage.setStore("test-branch", testData);
    const result = storage.getStore("test-branch");

    expect(Object.keys(result.clientPages)).toContain("test-page");
    expect(
      result.clientPages["test-page" as FernNavigation.NodeId]?.fullSlug
    ).toBe("test");
  });
});
