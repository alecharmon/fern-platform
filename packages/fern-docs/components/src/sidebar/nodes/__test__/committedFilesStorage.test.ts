import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommittedFilesStorage } from "../committedFilesStorage";

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

describe("CommittedFilesStorage", () => {
  const branchName = "test-branch";
  const testFilenames = ["page1.mdx", "page2.mdx", "section/page3.mdx"];

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("getStorageKey", () => {
    it("should generate correct storage key", () => {
      const key = CommittedFilesStorage.getStorageKey(branchName);
      expect(key).toBe("fern-committed-files-test-branch");
    });
  });

  describe("getCommittedClientPages", () => {
    it("should return empty Set when no data exists", () => {
      const files = CommittedFilesStorage.getCommittedClientPages(branchName);
      expect(files).toEqual(new Set());
      expect(files.size).toBe(0);
    });

    it("should return empty Set in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const files = CommittedFilesStorage.getCommittedClientPages(branchName);
      expect(files).toEqual(new Set());

      // Restore window
      global.window = originalWindow;
    });

    it("should load committed files from localStorage", () => {
      const expectedFiles = new Set(testFilenames);

      localStorageMock.setItem(
        CommittedFilesStorage.getStorageKey(branchName),
        JSON.stringify(testFilenames)
      );

      const files = CommittedFilesStorage.getCommittedClientPages(branchName);

      expect(files).toEqual(expectedFiles);
      expect(files.has("page1.mdx")).toBe(true);
      expect(files.has("page2.mdx")).toBe(true);
      expect(files.has("section/page3.mdx")).toBe(true);
      expect(files.has("nonexistent.mdx")).toBe(false);
    });

    it("should handle JSON parse errors gracefully", () => {
      localStorageMock.setItem(
        CommittedFilesStorage.getStorageKey(branchName),
        "invalid-json"
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const files = CommittedFilesStorage.getCommittedClientPages(branchName);

      expect(files).toEqual(new Set());
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load committed files from localStorage:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle null data gracefully", () => {
      localStorageMock.setItem(
        CommittedFilesStorage.getStorageKey(branchName),
        "null"
      );

      const files = CommittedFilesStorage.getCommittedClientPages(branchName);
      expect(files).toEqual(new Set());
    });
  });

  describe("setCommittedClientPages", () => {
    it("should save committed files to localStorage", () => {
      const filenames = new Set(testFilenames);

      CommittedFilesStorage.setCommittedClientPages(branchName, filenames);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        CommittedFilesStorage.getStorageKey(branchName),
        JSON.stringify(testFilenames)
      );
    });

    it("should handle server environment gracefully", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const filenames = new Set(testFilenames);

      // Should not throw
      CommittedFilesStorage.setCommittedClientPages(branchName, filenames);

      expect(true).toBe(true); // ESLint requires assertion

      // Restore window
      global.window = originalWindow;
    });

    it("should handle localStorage errors gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Storage quota exceeded");
      });

      const filenames = new Set(testFilenames);

      // Should not throw
      CommittedFilesStorage.setCommittedClientPages(branchName, filenames);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save committed files to localStorage:",
        expect.any(Error)
      );

      // Restore mocks
      localStorageMock.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });

    it("should preserve data integrity through round-trip", () => {
      const originalFiles = new Set(testFilenames);

      CommittedFilesStorage.setCommittedClientPages(branchName, originalFiles);
      const retrievedFiles =
        CommittedFilesStorage.getCommittedClientPages(branchName);

      expect(retrievedFiles).toEqual(originalFiles);
    });
  });

  describe("clearCommittedClientPages", () => {
    it("should clear committed files for a branch", () => {
      // Set some data first
      const filenames = new Set(testFilenames);
      CommittedFilesStorage.setCommittedClientPages(branchName, filenames);

      // Verify data exists
      expect(
        CommittedFilesStorage.getCommittedClientPages(branchName).size
      ).toBeGreaterThan(0);

      // Clear the data
      CommittedFilesStorage.clearCommittedClientPages(branchName);

      // Verify data is cleared
      expect(CommittedFilesStorage.getCommittedClientPages(branchName)).toEqual(
        new Set()
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        CommittedFilesStorage.getStorageKey(branchName)
      );
    });

    it("should handle server environment gracefully", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      // Should not throw
      CommittedFilesStorage.clearCommittedClientPages(branchName);

      expect(true).toBe(true); // ESLint requires assertion

      // Restore window
      global.window = originalWindow;
    });

    it("should handle localStorage errors gracefully", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const originalRemoveItem = localStorageMock.removeItem;
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error("Failed to remove");
      });

      // Should not throw
      CommittedFilesStorage.clearCommittedClientPages(branchName);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to clear committed files from localStorage:",
        expect.any(Error)
      );

      // Restore mocks
      localStorageMock.removeItem = originalRemoveItem;
      consoleSpy.mockRestore();
    });
  });

  describe("getAllStoredBranches", () => {
    it("should return all branch names with committed files", () => {
      const filenames = new Set(["test.mdx"]);

      CommittedFilesStorage.setCommittedClientPages("branch-1", filenames);
      CommittedFilesStorage.setCommittedClientPages("branch-2", filenames);
      CommittedFilesStorage.setCommittedClientPages("main", filenames);

      const branches = CommittedFilesStorage.getAllStoredBranches();

      expect(branches).toContain("branch-1");
      expect(branches).toContain("branch-2");
      expect(branches).toContain("main");
      expect(branches.length).toBe(3);
    });

    it("should return empty array in server environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing server environment
      delete global.window;

      const branches = CommittedFilesStorage.getAllStoredBranches();
      expect(branches).toEqual([]);

      // Restore window
      global.window = originalWindow;
    });

    it("should only return branches with the correct prefix", () => {
      const filenames = new Set(["test.mdx"]);

      // Add some data with the correct prefix
      CommittedFilesStorage.setCommittedClientPages("valid-branch", filenames);

      // Add some unrelated data to localStorage
      localStorageMock.setItem("other-prefix-branch", "data");
      localStorageMock.setItem("random-key", "value");

      const branches = CommittedFilesStorage.getAllStoredBranches();

      expect(branches).toContain("valid-branch");
      expect(branches).not.toContain("branch"); // from "other-prefix-branch"
      expect(branches).not.toContain("random-key");
      expect(branches.length).toBe(1);
    });

    it("should handle empty localStorage", () => {
      const branches = CommittedFilesStorage.getAllStoredBranches();
      expect(branches).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty Set correctly", () => {
      const emptySet = new Set<string>();

      CommittedFilesStorage.setCommittedClientPages(branchName, emptySet);
      const retrievedFiles =
        CommittedFilesStorage.getCommittedClientPages(branchName);

      expect(retrievedFiles).toEqual(new Set());
      expect(retrievedFiles.size).toBe(0);
    });

    it("should handle Set with duplicate values (shouldn't happen, but test robustness)", () => {
      const files = new Set(["file1.mdx", "file1.mdx", "file2.mdx"]);

      CommittedFilesStorage.setCommittedClientPages(branchName, files);
      const retrievedFiles =
        CommittedFilesStorage.getCommittedClientPages(branchName);

      expect(retrievedFiles.size).toBe(2); // Set should deduplicate
      expect(retrievedFiles.has("file1.mdx")).toBe(true);
      expect(retrievedFiles.has("file2.mdx")).toBe(true);
    });

    it("should handle branch names with special characters", () => {
      const specialBranchName = "feature/test-branch_v1.0";
      const filenames = new Set(["test.mdx"]);

      CommittedFilesStorage.setCommittedClientPages(
        specialBranchName,
        filenames
      );
      const retrievedFiles =
        CommittedFilesStorage.getCommittedClientPages(specialBranchName);

      expect(retrievedFiles).toEqual(filenames);

      const branches = CommittedFilesStorage.getAllStoredBranches();
      expect(branches).toContain(specialBranchName);
    });
  });
});
