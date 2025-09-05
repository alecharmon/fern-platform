import { PageData } from "./types";

export interface StoredPageData extends PageData {
  lastModified: number;
  // Track if this is a client-only page or a server page with local changes
  pageType: "client" | "server";
  // For server pages, store the original server data for comparison
  serverData?: PageData;
}

export type StoredPages = Record<string, StoredPageData>; // keyed by filename

export class PageStorage {
  private static readonly STORAGE_KEY_PREFIX = "fern-pages";

  static getStorageKey(branchName: string): string {
    return `${this.STORAGE_KEY_PREFIX}-${branchName}`;
  }

  static loadPages(branchName: string): StoredPages {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const key = this.getStorageKey(branchName);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored) as StoredPages;

      // Validate the structure and clean up old entries (older than 30 days)
      const now = Date.now();
      const monthInMs = 30 * 24 * 60 * 60 * 1000;
      const validPages: StoredPages = {};

      Object.entries(parsed).forEach(([filename, pageData]) => {
        if (pageData.lastModified && now - pageData.lastModified < monthInMs) {
          validPages[filename] = pageData;
        }
      });

      // Save back the cleaned data if we removed anything
      if (Object.keys(validPages).length !== Object.keys(parsed).length) {
        this.savePages(branchName, validPages);
      }

      return validPages;
    } catch (error) {
      console.error("Failed to load pages from localStorage:", error);
      return {};
    }
  }

  static savePages(branchName: string, pages: StoredPages): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.setItem(key, JSON.stringify(pages));
    } catch (error) {
      console.error("Failed to save pages to localStorage:", error);
    }
  }

  static savePage(
    branchName: string,
    filename: string,
    pageData: Omit<StoredPageData, "lastModified">
  ): void {
    const pages = this.loadPages(branchName);
    pages[filename] = {
      ...pageData,
      lastModified: Date.now(),
    };
    this.savePages(branchName, pages);
  }

  static getPage(
    branchName: string,
    filename: string
  ): StoredPageData | undefined {
    const pages = this.loadPages(branchName);
    return pages[filename];
  }

  static removePage(branchName: string, filename: string): void {
    const pages = this.loadPages(branchName);
    const { [filename]: removed, ...remainingPages } = pages;
    this.savePages(branchName, remainingPages);
  }

  static clearAllPages(branchName: string): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to clear pages from localStorage:", error);
    }
  }

  // Check if a page has local changes compared to server data
  static hasLocalChanges(
    branchName: string,
    filename: string,
    serverData: PageData
  ): boolean {
    const storedPage = this.getPage(branchName, filename);
    if (!storedPage || storedPage.pageType === "client") {
      return false;
    }

    // Compare current stored data with server data
    return (
      storedPage.html !== serverData.html ||
      JSON.stringify(storedPage.frontmatter) !==
        JSON.stringify(serverData.frontmatter)
    );
  }

  // Get all branch names that have stored pages (for cleanup)
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
