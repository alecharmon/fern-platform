import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocsYmlStorage } from "../docsYmlStorage";
import type {
  DocsYmlPageEntry,
  DocsYmlState,
  DocsYmlUpdate,
} from "../docsYmlTypes";

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

describe("DocsYmlStorage", () => {
  const branchName = "test-branch";
  const baseContent = `navigation:
  - section: Getting Started
    contents:
      - page: Introduction
        path: intro.mdx`;

  const mockPageEntry: DocsYmlPageEntry = {
    page: "Test Page",
    path: "test-page.mdx",
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("getStorageKey", () => {
    it("should generate correct storage key", () => {
      const key = DocsYmlStorage.getStorageKey(branchName);
      expect(key).toBe("fern-docs-yml-state-test-branch");
    });
  });

  describe("loadState", () => {
    it("should return null when no data exists", () => {
      const state = DocsYmlStorage.loadState(branchName);
      expect(state).toBeNull();
    });

    it("should return null in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const state = DocsYmlStorage.loadState(branchName);
      expect(state).toBeNull();

      // Restore window
      global.window = originalWindow;
    });

    it("should load state from localStorage", () => {
      const testState: DocsYmlState = {
        baseContent,
        updates: {},
        lastFetched: Date.now(),
      };

      localStorageMock.setItem(
        DocsYmlStorage.getStorageKey(branchName),
        JSON.stringify(testState)
      );

      const state = DocsYmlStorage.loadState(branchName);

      expect(state).toEqual(testState);
    });

    it("should clean up old updates", () => {
      const now = Date.now();
      const oldUpdate: DocsYmlUpdate = {
        sectionTitle: "Old Section",
        pageEntry: mockPageEntry,
        createdAt: now - 8 * 24 * 60 * 60 * 1000, // 8 days old
        operation: "add",
      };

      const recentUpdate: DocsYmlUpdate = {
        sectionTitle: "Recent Section",
        pageEntry: mockPageEntry,
        createdAt: now - 1 * 24 * 60 * 60 * 1000, // 1 day old
        operation: "add",
      };

      const testState: DocsYmlState = {
        baseContent,
        updates: {
          "old-page.mdx": oldUpdate,
          "recent-page.mdx": recentUpdate,
        },
        lastFetched: now,
      };

      localStorageMock.setItem(
        DocsYmlStorage.getStorageKey(branchName),
        JSON.stringify(testState)
      );

      const state = DocsYmlStorage.loadState(branchName);

      expect(state?.updates).toEqual({
        "recent-page.mdx": recentUpdate,
      });
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2); // Initial set + cleanup save
    });

    it("should handle JSON parse errors gracefully", () => {
      localStorageMock.setItem(
        DocsYmlStorage.getStorageKey(branchName),
        "invalid-json"
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const state = DocsYmlStorage.loadState(branchName);

      expect(state).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("setBaseContent", () => {
    it("should set base content and timestamp", () => {
      const beforeTime = Date.now();

      DocsYmlStorage.setBaseContent(branchName, baseContent);

      const state = DocsYmlStorage.loadState(branchName);

      expect(state?.baseContent).toBe(baseContent);
      expect(state?.lastFetched).toBeGreaterThanOrEqual(beforeTime);
      expect(state?.updates).toEqual({});
    });

    it("should preserve existing updates", () => {
      // First set some updates
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      const stateWithUpdate = DocsYmlStorage.loadState(branchName);
      expect(Object.keys(stateWithUpdate?.updates || {})).toHaveLength(1);

      // Set new base content
      const newBaseContent = "navigation: []";
      DocsYmlStorage.setBaseContent(branchName, newBaseContent);

      const finalState = DocsYmlStorage.loadState(branchName);
      expect(finalState?.baseContent).toBe(newBaseContent);
      expect(Object.keys(finalState?.updates || {})).toHaveLength(1); // Updates preserved
    });

    it("should handle empty branch name", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      DocsYmlStorage.setBaseContent("", baseContent);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Branch name is required for setting base content"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("addUpdate", () => {
    beforeEach(() => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
    });

    it("should add an update", () => {
      const sectionTitle = "Test Section";
      const beforeTime = Date.now();

      DocsYmlStorage.addUpdate(branchName, sectionTitle, mockPageEntry);

      const state = DocsYmlStorage.loadState(branchName);
      const pagePath = mockPageEntry.path;
      if (pagePath && state) {
        const update = state.updates[pagePath];

        expect(update).toBeDefined();
        expect(update?.sectionTitle).toBe(sectionTitle);
        expect(update?.pageEntry).toEqual(mockPageEntry);
        expect(update?.operation).toBe("add");
        expect(update?.createdAt).toBeGreaterThanOrEqual(beforeTime);
      }
    });

    it("should handle invalid parameters", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      DocsYmlStorage.addUpdate("", "Section", mockPageEntry);
      DocsYmlStorage.addUpdate(branchName, "Section", {
        page: "Test",
        path: "",
      });

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it("should warn if no base content exists", () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      DocsYmlStorage.addUpdate("no-base-branch", "Section", mockPageEntry);

      expect(consoleSpy).toHaveBeenCalledWith(
        "No base content found for branch. Call setBaseContent first."
      );
      consoleSpy.mockRestore();
    });
  });

  describe("addRemovalUpdate", () => {
    beforeEach(() => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
    });

    it("should add a removal update", () => {
      const pagePath = "remove-me.mdx";
      const beforeTime = Date.now();

      DocsYmlStorage.addRemovalUpdate(branchName, pagePath);

      const state = DocsYmlStorage.loadState(branchName);
      const update = state?.updates[pagePath];

      expect(update).toBeDefined();
      expect(update?.operation).toBe("remove");
      expect(update?.pageEntry.path).toBe(pagePath);
      expect(update?.createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it("should handle invalid parameters", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      DocsYmlStorage.addRemovalUpdate("", "test.mdx");
      DocsYmlStorage.addRemovalUpdate(branchName, "");

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  describe("removeUpdate", () => {
    beforeEach(() => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);
    });

    it("should remove an update", () => {
      // Verify update exists
      const pagePath = mockPageEntry.path;
      if (pagePath) {
        expect(
          DocsYmlStorage.loadState(branchName)?.updates[pagePath]
        ).toBeDefined();

        // Remove it
        DocsYmlStorage.removeUpdate(branchName, pagePath);

        // Verify it's gone
        expect(
          DocsYmlStorage.loadState(branchName)?.updates[pagePath]
        ).toBeUndefined();
      }
    });

    it("should handle invalid parameters", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      DocsYmlStorage.removeUpdate("", "test.mdx");
      DocsYmlStorage.removeUpdate(branchName, "");

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  describe("getFinalContent", () => {
    it("should return null when no base content exists", () => {
      const content = DocsYmlStorage.getFinalContent(branchName);
      expect(content).toBeNull();
    });

    it("should return base content when no updates exist", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);

      const content = DocsYmlStorage.getFinalContent(branchName);
      expect(content).toBe(baseContent);
    });

    it("should warn about needing updater function", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const content = DocsYmlStorage.getFinalContent(branchName);

      expect(content).toBe(baseContent);
      expect(consoleSpy).toHaveBeenCalledWith(
        "getFinalContent called but updates cannot be applied in components package. Use getFinalContentWithUpdater instead."
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getFinalContentWithUpdater", () => {
    const mockAddPageFn = vi.fn(
      (content: string, section: string, pageEntry: any) =>
        `${content}\n# Added: ${pageEntry.page} in ${section}`
    );
    const mockRemovePageFn = vi.fn(
      (content: string, pagePath: string) =>
        `${content}\n# Removed: ${pagePath}`
    );

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return null when no base content exists", () => {
      const content = DocsYmlStorage.getFinalContentWithUpdater(
        branchName,
        mockAddPageFn,
        mockRemovePageFn
      );
      expect(content).toBeNull();
    });

    it("should return base content when no updates exist", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);

      const content = DocsYmlStorage.getFinalContentWithUpdater(
        branchName,
        mockAddPageFn,
        mockRemovePageFn
      );
      expect(content).toBe(baseContent);
      expect(mockAddPageFn).not.toHaveBeenCalled();
      expect(mockRemovePageFn).not.toHaveBeenCalled();
    });

    it("should apply add updates", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      const content = DocsYmlStorage.getFinalContentWithUpdater(
        branchName,
        mockAddPageFn,
        mockRemovePageFn
      );

      expect(mockAddPageFn).toHaveBeenCalledWith(
        baseContent,
        "Test Section",
        mockPageEntry
      );
      expect(content).toContain("Added: Test Page in Test Section");
    });

    it("should apply remove updates", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addRemovalUpdate(branchName, "remove-me.mdx");

      const content = DocsYmlStorage.getFinalContentWithUpdater(
        branchName,
        mockAddPageFn,
        mockRemovePageFn
      );

      expect(mockRemovePageFn).toHaveBeenCalledWith(
        baseContent,
        "remove-me.mdx"
      );
      expect(content).toContain("Removed: remove-me.mdx");
    });

    it("should apply updates in chronological order", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);

      // Add updates with different timestamps
      const now = Date.now();
      DocsYmlStorage.addUpdate(branchName, "First Section", {
        page: "First",
        path: "first.mdx",
      });
      DocsYmlStorage.addUpdate(branchName, "Second Section", {
        page: "Second",
        path: "second.mdx",
      });

      // Mock the timestamps to ensure order
      const state = DocsYmlStorage.loadState(branchName);
      if (state) {
        const firstUpdate = state.updates["first.mdx"];
        const secondUpdate = state.updates["second.mdx"];
        if (firstUpdate && secondUpdate) {
          firstUpdate.createdAt = now - 1000;
          secondUpdate.createdAt = now;
          DocsYmlStorage.saveState(branchName, state);

          DocsYmlStorage.getFinalContentWithUpdater(
            branchName,
            mockAddPageFn,
            mockRemovePageFn
          );

          expect(mockAddPageFn).toHaveBeenCalledTimes(2);
          const firstCall = mockAddPageFn.mock.calls[0];
          const secondCall = mockAddPageFn.mock.calls[1];
          if (firstCall && secondCall) {
            expect(firstCall[1]).toBe("First Section");
            expect(secondCall[1]).toBe("Second Section");
          }
        }
      }
    });

    it("should handle updater function errors", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      const errorAddFn = vi.fn(() => {
        throw new Error("Update failed");
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const content = DocsYmlStorage.getFinalContentWithUpdater(
        branchName,
        errorAddFn,
        mockRemovePageFn
      );

      expect(content).toBe(baseContent); // Should return base content on error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error applying docs.yml updates:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("hasUpdates", () => {
    it("should return false when no updates exist", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);

      expect(DocsYmlStorage.hasUpdates(branchName)).toBe(false);
    });

    it("should return true when updates exist", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      expect(DocsYmlStorage.hasUpdates(branchName)).toBe(true);
    });

    it("should return false for non-existent branch", () => {
      expect(DocsYmlStorage.hasUpdates("non-existent-branch")).toBe(false);
    });
  });

  describe("clearAllUpdates", () => {
    it("should clear all updates while preserving base content", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      expect(DocsYmlStorage.hasUpdates(branchName)).toBe(true);

      DocsYmlStorage.clearAllUpdates(branchName);

      expect(DocsYmlStorage.hasUpdates(branchName)).toBe(false);
      expect(DocsYmlStorage.loadState(branchName)?.baseContent).toBe(
        baseContent
      );
    });
  });

  describe("clearAll", () => {
    it("should clear all data for a branch", () => {
      DocsYmlStorage.setBaseContent(branchName, baseContent);
      DocsYmlStorage.addUpdate(branchName, "Test Section", mockPageEntry);

      expect(DocsYmlStorage.loadState(branchName)).not.toBeNull();

      DocsYmlStorage.clearAll(branchName);

      expect(DocsYmlStorage.loadState(branchName)).toBeNull();
    });

    it("should handle server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      // Should not throw
      DocsYmlStorage.clearAll(branchName);
      expect(true).toBe(true);

      // Restore window
      global.window = originalWindow;
    });
  });

  describe("getAllStoredBranches", () => {
    it("should return all branch names with stored data", () => {
      DocsYmlStorage.setBaseContent("branch-1", baseContent);
      DocsYmlStorage.setBaseContent("branch-2", baseContent);
      DocsYmlStorage.setBaseContent("main", baseContent);

      const branches = DocsYmlStorage.getAllStoredBranches();

      expect(branches).toContain("branch-1");
      expect(branches).toContain("branch-2");
      expect(branches).toContain("main");
      expect(branches.length).toBe(3);
    });

    it("should return empty array in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const branches = DocsYmlStorage.getAllStoredBranches();
      expect(branches).toEqual([]);

      // Restore window
      global.window = originalWindow;
    });
  });
});
