import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PageStorage,
  type StoredPageData,
  type StoredPages,
} from "../pageStorage";
import type { PageData } from "../types";

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

describe("PageStorage", () => {
  const branchName = "test-branch";
  const filename = "test-page.mdx";

  const mockPageData: PageData = {
    html: "<h1>Test Page</h1>",
    frontmatter: { title: "Test Page" },
    originalElements: [] as any,
  };

  const mockStoredPageData: Omit<StoredPageData, "lastModified"> = {
    ...mockPageData,
    pageType: "client",
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("getStorageKey", () => {
    it("should generate correct storage key", () => {
      const key = PageStorage.getStorageKey(branchName);
      expect(key).toBe("fern-pages-test-branch");
    });
  });

  describe("loadPages", () => {
    it("should return empty object when no data exists", () => {
      const pages = PageStorage.loadPages(branchName);
      expect(pages).toEqual({});
    });

    it("should return empty object in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const pages = PageStorage.loadPages(branchName);
      expect(pages).toEqual({});

      // Restore window
      global.window = originalWindow;
    });

    it("should load pages from localStorage", () => {
      const testData: StoredPages = {
        [filename]: {
          ...mockStoredPageData,
          lastModified: Date.now(),
        },
      };

      localStorageMock.setItem(
        PageStorage.getStorageKey(branchName),
        JSON.stringify(testData)
      );

      const pages = PageStorage.loadPages(branchName);

      expect(pages).toEqual(testData);
      const savedPage = pages[filename];
      if (savedPage) {
        expect(savedPage.html).toBe(mockPageData.html);
        expect(savedPage.pageType).toBe("client");
      }
    });

    it("should clean up old entries (older than 30 days)", () => {
      const now = Date.now();
      const oldPage = {
        ...mockStoredPageData,
        lastModified: now - 31 * 24 * 60 * 60 * 1000, // 31 days old
      };
      const recentPage = {
        ...mockStoredPageData,
        lastModified: now - 1 * 24 * 60 * 60 * 1000, // 1 day old
      };

      const testData: StoredPages = {
        "old-page.mdx": oldPage,
        "recent-page.mdx": recentPage,
      };

      localStorageMock.setItem(
        PageStorage.getStorageKey(branchName),
        JSON.stringify(testData)
      );

      const pages = PageStorage.loadPages(branchName);

      expect(pages).toEqual({ "recent-page.mdx": recentPage });
      expect(pages["old-page.mdx"]).toBeUndefined();
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2); // Initial set + cleanup save
    });

    it("should handle JSON parse errors gracefully", () => {
      localStorageMock.setItem(
        PageStorage.getStorageKey(branchName),
        "invalid-json"
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const pages = PageStorage.loadPages(branchName);

      expect(pages).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load pages from localStorage:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("savePage", () => {
    it("should save a page with timestamp", () => {
      const beforeTime = Date.now();

      PageStorage.savePage(branchName, filename, mockStoredPageData);

      const pages = PageStorage.loadPages(branchName);
      const savedPage = pages[filename];

      expect(savedPage).toBeDefined();
      if (savedPage) {
        expect(savedPage.html).toBe(mockPageData.html);
        expect(savedPage.frontmatter).toEqual(mockPageData.frontmatter);
        expect(savedPage.pageType).toBe("client");
        expect(savedPage.lastModified).toBeGreaterThanOrEqual(beforeTime);
        expect(savedPage.lastModified).toBeLessThanOrEqual(Date.now());
      }
    });

    it("should overwrite existing page", () => {
      // Save initial page
      PageStorage.savePage(branchName, filename, mockStoredPageData);

      // Save updated page
      const updatedPageData = {
        ...mockStoredPageData,
        html: "<h1>Updated Page</h1>",
        frontmatter: { title: "Updated Page" },
      };

      PageStorage.savePage(branchName, filename, updatedPageData);

      const pages = PageStorage.loadPages(branchName);
      const page = pages[filename];
      if (page) {
        expect(page.html).toBe("<h1>Updated Page</h1>");
        expect(page.frontmatter.title).toBe("Updated Page");
      }
    });

    it("should handle server page with server data", () => {
      const serverPageData: Omit<StoredPageData, "lastModified"> = {
        ...mockPageData,
        pageType: "server",
        serverData: {
          html: "<h1>Original Server Content</h1>",
          frontmatter: { title: "Original" },
          originalElements: [] as any,
        },
      };

      PageStorage.savePage(branchName, filename, serverPageData);

      const pages = PageStorage.loadPages(branchName);
      const savedPage = pages[filename];

      if (savedPage) {
        expect(savedPage.pageType).toBe("server");
        expect(savedPage.serverData).toBeDefined();
        expect(savedPage.serverData?.html).toBe(
          "<h1>Original Server Content</h1>"
        );
      }
    });
  });

  describe("getPage", () => {
    it("should return undefined for non-existent page", () => {
      const page = PageStorage.getPage(branchName, filename);
      expect(page).toBeUndefined();
    });

    it("should return stored page data", () => {
      PageStorage.savePage(branchName, filename, mockStoredPageData);

      const page = PageStorage.getPage(branchName, filename);

      expect(page).toBeDefined();
      expect(page?.html).toBe(mockPageData.html);
      expect(page?.pageType).toBe("client");
    });
  });

  describe("removePage", () => {
    it("should remove a page", () => {
      // Save a page first
      PageStorage.savePage(branchName, filename, mockStoredPageData);
      expect(PageStorage.getPage(branchName, filename)).toBeDefined();

      // Remove it
      PageStorage.removePage(branchName, filename);
      expect(PageStorage.getPage(branchName, filename)).toBeUndefined();
    });

    it("should handle removing non-existent page", () => {
      // Should not throw
      PageStorage.removePage(branchName, "non-existent.mdx");
      expect(true).toBe(true);
    });

    it("should preserve other pages when removing one", () => {
      const otherFilename = "other-page.mdx";

      // Save two pages
      PageStorage.savePage(branchName, filename, mockStoredPageData);
      PageStorage.savePage(branchName, otherFilename, mockStoredPageData);

      expect(Object.keys(PageStorage.loadPages(branchName))).toHaveLength(2);

      // Remove one
      PageStorage.removePage(branchName, filename);

      const remainingPages = PageStorage.loadPages(branchName);
      expect(remainingPages[filename]).toBeUndefined();
      expect(remainingPages[otherFilename]).toBeDefined();
    });
  });

  describe("clearAllPages", () => {
    it("should clear all pages for a branch", () => {
      // Save some pages
      PageStorage.savePage(branchName, filename, mockStoredPageData);
      PageStorage.savePage(branchName, "other-page.mdx", mockStoredPageData);

      expect(Object.keys(PageStorage.loadPages(branchName))).toHaveLength(2);

      // Clear all
      PageStorage.clearAllPages(branchName);

      expect(PageStorage.loadPages(branchName)).toEqual({});
    });

    it("should handle server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      // Should not throw
      PageStorage.clearAllPages(branchName);
      expect(true).toBe(true);

      // Restore window
      global.window = originalWindow;
    });

    it("should handle localStorage errors gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error("Failed to remove");
      });

      // Should not throw
      PageStorage.clearAllPages(branchName);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to clear pages from localStorage:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("hasLocalChanges", () => {
    it("should return false for client pages", () => {
      const clientPageData: Omit<StoredPageData, "lastModified"> = {
        ...mockPageData,
        pageType: "client",
      };

      PageStorage.savePage(branchName, filename, clientPageData);

      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        filename,
        mockPageData
      );
      expect(hasChanges).toBe(false);
    });

    it("should return false for non-existent pages", () => {
      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        "non-existent.mdx",
        mockPageData
      );
      expect(hasChanges).toBe(false);
    });

    it("should return false when server page matches server data", () => {
      const serverPageData: Omit<StoredPageData, "lastModified"> = {
        ...mockPageData,
        pageType: "server",
        serverData: mockPageData,
      };

      PageStorage.savePage(branchName, filename, serverPageData);

      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        filename,
        mockPageData
      );
      expect(hasChanges).toBe(false);
    });

    it("should return true when server page differs from server data", () => {
      const localPageData = {
        html: "<h1>Modified Content</h1>",
        frontmatter: { title: "Modified Title" },
        originalElements: [] as any,
      };

      const serverPageData: Omit<StoredPageData, "lastModified"> = {
        ...localPageData,
        pageType: "server",
        serverData: mockPageData, // Different from local data
      };

      PageStorage.savePage(branchName, filename, serverPageData);

      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        filename,
        mockPageData
      );
      expect(hasChanges).toBe(true);
    });

    it("should detect changes in HTML content", () => {
      const serverPageData: Omit<StoredPageData, "lastModified"> = {
        ...mockPageData,
        html: "<h1>Different HTML</h1>", // Different from server data
        pageType: "server",
        serverData: mockPageData,
      };

      PageStorage.savePage(branchName, filename, serverPageData);

      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        filename,
        mockPageData
      );
      expect(hasChanges).toBe(true);
    });

    it("should detect changes in frontmatter", () => {
      const serverPageData: Omit<StoredPageData, "lastModified"> = {
        ...mockPageData,
        frontmatter: { title: "Different Title" }, // Different from server data
        pageType: "server",
        serverData: mockPageData,
      };

      PageStorage.savePage(branchName, filename, serverPageData);

      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        filename,
        mockPageData
      );
      expect(hasChanges).toBe(true);
    });

    it("should detect changes in originalElements", () => {
      const differentElements = [{ type: "element", tagName: "div" }] as any;

      const serverPageData: Omit<StoredPageData, "lastModified"> = {
        ...mockPageData,
        originalElements: differentElements, // Different from server data
        pageType: "server",
        serverData: mockPageData,
      };

      PageStorage.savePage(branchName, filename, serverPageData);

      const hasChanges = PageStorage.hasLocalChanges(
        branchName,
        filename,
        mockPageData
      );
      expect(hasChanges).toBe(true);
    });
  });

  describe("getAllStoredBranches", () => {
    it("should return all branch names with stored pages", () => {
      PageStorage.savePage("branch-1", filename, mockStoredPageData);
      PageStorage.savePage("branch-2", filename, mockStoredPageData);
      PageStorage.savePage("main", filename, mockStoredPageData);

      const branches = PageStorage.getAllStoredBranches();

      expect(branches).toContain("branch-1");
      expect(branches).toContain("branch-2");
      expect(branches).toContain("main");
      expect(branches.length).toBe(3);
    });

    it("should return empty array in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const branches = PageStorage.getAllStoredBranches();
      expect(branches).toEqual([]);

      // Restore window
      global.window = originalWindow;
    });

    it("should only return branches with the correct prefix", () => {
      PageStorage.savePage("valid-branch", filename, mockStoredPageData);

      // Add some unrelated data to localStorage
      localStorageMock.setItem("other-prefix-branch", "data");
      localStorageMock.setItem("random-key", "value");

      const branches = PageStorage.getAllStoredBranches();

      expect(branches).toContain("valid-branch");
      expect(branches).not.toContain("branch"); // from "other-prefix-branch"
      expect(branches).not.toContain("random-key");
      expect(branches.length).toBe(1);
    });
  });

  describe("savePages", () => {
    it("should save multiple pages at once", () => {
      const pages: StoredPages = {
        "page1.mdx": {
          ...mockStoredPageData,
          lastModified: Date.now(),
        },
        "page2.mdx": {
          ...mockStoredPageData,
          html: "<h1>Page 2</h1>",
          lastModified: Date.now(),
        },
      };

      PageStorage.savePages(branchName, pages);

      const loadedPages = PageStorage.loadPages(branchName);
      expect(loadedPages).toEqual(pages);
      expect(Object.keys(loadedPages)).toHaveLength(2);
    });

    it("should handle server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const pages: StoredPages = {
        "page1.mdx": { ...mockStoredPageData, lastModified: Date.now() },
      };

      // Should not throw
      PageStorage.savePages(branchName, pages);
      expect(true).toBe(true);

      // Restore window
      global.window = originalWindow;
    });

    it("should handle localStorage errors gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Storage quota exceeded");
      });

      const pages: StoredPages = {
        "page1.mdx": { ...mockStoredPageData, lastModified: Date.now() },
      };

      // Should not throw
      PageStorage.savePages(branchName, pages);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save pages to localStorage:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
