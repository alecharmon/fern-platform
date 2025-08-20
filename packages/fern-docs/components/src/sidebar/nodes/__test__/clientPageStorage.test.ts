import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ClientPageStorage,
  type StoredClientPage,
  type StoredClientPages,
} from "../clientPageStorage";

// Mock window and localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

// Mock the global objects
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("ClientPageStorage", () => {
  const branchName = "test-branch";
  const mockClientPage: Omit<StoredClientPage, "createdAt"> = {
    node: {
      id: "page-1" as any,
      title: "Test Page",
      slug: "test-page",
      type: "page",
    } as any,
    parentNodeId: "section-1" as any,
    sidebar: {
      children: [
        {
          id: "section-1",
          title: "Test Section",
          type: "section",
        },
      ],
    } as any,
    fullSlug: "test-section/test-page",
    pageData: {
      html: "<h1>Test</h1>",
      frontmatter: { title: "Test Page" },
      originalElements: [] as any,
    },
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("getStorageKey", () => {
    it("should generate correct storage key", () => {
      const key = ClientPageStorage.getStorageKey(branchName);
      expect(key).toBe("fern-client-pages-test-branch");
    });
  });

  describe("loadClientPages", () => {
    it("should return empty object when no data exists", () => {
      const pages = ClientPageStorage.loadClientPages(branchName);
      expect(pages).toEqual({});
    });

    it("should return empty object in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const pages = ClientPageStorage.loadClientPages(branchName);
      expect(pages).toEqual({});

      // Restore window
      global.window = originalWindow;
    });

    it("should load and clean up old entries", () => {
      const now = Date.now();
      const oldPage = {
        ...mockClientPage,
        createdAt: now - 8 * 24 * 60 * 60 * 1000,
      }; // 8 days old
      const recentPage = {
        ...mockClientPage,
        createdAt: now - 1 * 24 * 60 * 60 * 1000,
      }; // 1 day old

      const testData = {
        "old-page": oldPage,
        "recent-page": recentPage,
      };

      localStorageMock.setItem(
        ClientPageStorage.getStorageKey(branchName),
        JSON.stringify(testData)
      );

      const pages = ClientPageStorage.loadClientPages(branchName);

      expect(pages).toEqual({ "recent-page": recentPage });
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2); // Initial set + cleanup save
    });

    it("should handle JSON parse errors gracefully", () => {
      localStorageMock.setItem(
        ClientPageStorage.getStorageKey(branchName),
        "invalid-json"
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const pages = ClientPageStorage.loadClientPages(branchName);

      expect(pages).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("addClientPage", () => {
    it("should add a client page with timestamp", () => {
      const nodeId = "page-1" as any;
      const beforeTime = Date.now();

      ClientPageStorage.addClientPage(branchName, nodeId, mockClientPage);

      const pages = ClientPageStorage.loadClientPages(branchName);
      const savedPage = pages[nodeId as keyof StoredClientPages];

      expect(savedPage).toBeDefined();
      if (savedPage) {
        expect(savedPage.node).toEqual(mockClientPage.node);
        expect(savedPage.fullSlug).toBe(mockClientPage.fullSlug);
        expect(savedPage.createdAt).toBeGreaterThanOrEqual(beforeTime);
        expect(savedPage.createdAt).toBeLessThanOrEqual(Date.now());
      }
    });

    it("should handle invalid branch name", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      ClientPageStorage.addClientPage("", "page-1" as any, mockClientPage);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Branch name is required for adding client page"
      );
      consoleSpy.mockRestore();
    });

    it("should handle invalid node ID", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      ClientPageStorage.addClientPage(branchName, "" as any, mockClientPage);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Node ID is required for adding client page"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("removeClientPage", () => {
    it("should remove a client page", () => {
      const nodeId = "page-1" as any;

      // Add a page first
      ClientPageStorage.addClientPage(branchName, nodeId, mockClientPage);
      expect(
        ClientPageStorage.loadClientPages(branchName)[
          nodeId as keyof StoredClientPages
        ]
      ).toBeDefined();

      // Remove it
      ClientPageStorage.removeClientPage(branchName, nodeId);
      expect(
        ClientPageStorage.loadClientPages(branchName)[
          nodeId as keyof StoredClientPages
        ]
      ).toBeUndefined();
    });

    it("should handle invalid parameters", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      ClientPageStorage.removeClientPage("", "page-1" as any);
      ClientPageStorage.removeClientPage(branchName, "" as any);

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  describe("updateClientPageData", () => {
    it("should update page data for existing page", () => {
      const nodeId = "page-1" as any;
      const updatedPageData = {
        html: "<h1>Updated</h1>",
        frontmatter: { title: "Updated Page" },
        originalElements: [] as any,
      };

      // Add a page first
      ClientPageStorage.addClientPage(branchName, nodeId, mockClientPage);

      // Update the page data
      ClientPageStorage.updateClientPageData(
        branchName,
        nodeId,
        updatedPageData
      );

      const pages = ClientPageStorage.loadClientPages(branchName);
      const page = pages[nodeId as keyof StoredClientPages];
      if (page) {
        expect(page.pageData).toEqual(updatedPageData);
      }
    });

    it("should handle missing page", () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      ClientPageStorage.updateClientPageData(branchName, "nonexistent" as any, {
        html: "<h1>Test</h1>",
        frontmatter: {},
        originalElements: [] as any,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Client page with node ID nonexistent not found for update"
      );
      consoleSpy.mockRestore();
    });

    it("should validate page data completeness", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      ClientPageStorage.updateClientPageData(branchName, "page-1" as any, {
        html: "",
        frontmatter: {},
        originalElements: [] as any,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Complete page data is required for updating client page"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("clearAllClientPages", () => {
    it("should clear all client pages for a branch", () => {
      // Add some pages
      ClientPageStorage.addClientPage(
        branchName,
        "page-1" as any,
        mockClientPage
      );
      ClientPageStorage.addClientPage(
        branchName,
        "page-2" as any,
        mockClientPage
      );

      expect(
        Object.keys(ClientPageStorage.loadClientPages(branchName))
      ).toHaveLength(2);

      // Clear all
      ClientPageStorage.clearAllClientPages(branchName);

      expect(ClientPageStorage.loadClientPages(branchName)).toEqual({});
    });

    it("should handle server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      // Should not throw
      ClientPageStorage.clearAllClientPages(branchName);
      expect(true).toBe(true); // Just to have an assertion

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("getAllStoredBranches", () => {
    it("should return all branch names with stored data", () => {
      ClientPageStorage.addClientPage(
        "branch-1",
        "page-1" as any,
        mockClientPage
      );
      ClientPageStorage.addClientPage(
        "branch-2",
        "page-2" as any,
        mockClientPage
      );

      const branches = ClientPageStorage.getAllStoredBranches();

      expect(branches).toContain("branch-1");
      expect(branches).toContain("branch-2");
    });

    it("should return empty array in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const branches = ClientPageStorage.getAllStoredBranches();
      expect(branches).toEqual([]);

      // Restore window
      global.window = originalWindow;
    });
  });
});
