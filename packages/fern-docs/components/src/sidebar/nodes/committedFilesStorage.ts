/**
 * Storage for tracking files that have been committed to Git.
 * This helps us identify which files need to be deleted when they're no longer present.
 */
export class CommittedFilesStorage {
  private static readonly STORAGE_KEY_PREFIX = "fern-committed-files";

  static getStorageKey(branchName: string): string {
    return `${this.STORAGE_KEY_PREFIX}-${branchName}`;
  }

  static getCommittedClientPages(branchName: string): Set<string> {
    if (typeof window === "undefined") {
      return new Set();
    }

    try {
      const key = this.getStorageKey(branchName);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return new Set();
      }

      const parsed = JSON.parse(stored) as string[];
      return new Set(parsed);
    } catch (error) {
      console.error("Failed to load committed files from localStorage:", error);
      return new Set();
    }
  }

  static setCommittedClientPages(
    branchName: string,
    filenames: Set<string>
  ): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      const arrayData = Array.from(filenames);
      localStorage.setItem(key, JSON.stringify(arrayData));
    } catch (error) {
      console.error("Failed to save committed files to localStorage:", error);
    }
  }

  static clearCommittedClientPages(branchName: string): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.removeItem(key);
    } catch (error) {
      console.error(
        "Failed to clear committed files from localStorage:",
        error
      );
    }
  }

  // Get all branch names that have stored committed files (for cleanup)
  static getAllStoredBranches(): string[] {
    if (typeof window === "undefined") {
      return [];
    }

    const branches: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_KEY_PREFIX)) {
        const branchName = key.replace(`${this.STORAGE_KEY_PREFIX}-`, "");
        branches.push(branchName);
      }
    }
    return branches;
  }
}
