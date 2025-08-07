import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";

import { PageData } from "./types";

export interface StoredClientPage {
  node: FernNavigation.PageNode;
  parentNodeId: NodeId;
  sidebar?: FernNavigation.SidebarRootNode;
  createdAt: number;
  // Store the full slug for routing
  fullSlug: string;
  // Store the page content data for editor
  pageData?: PageData;
}

export type StoredClientPages = Record<NodeId, StoredClientPage>;

export class ClientPageStorage {
  private static readonly STORAGE_KEY_PREFIX = "fern-client-pages";

  static getStorageKey(branchName: string): string {
    return `${this.STORAGE_KEY_PREFIX}-${branchName}`;
  }

  static loadClientPages(branchName: string): StoredClientPages {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const key = this.getStorageKey(branchName);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored) as StoredClientPages;

      // Validate the structure and clean up old entries (older than 7 days)
      const now = Date.now();
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      const validPages: StoredClientPages = {};

      Object.entries(parsed).forEach(([nodeId, page]) => {
        if (page.createdAt && now - page.createdAt < weekInMs) {
          validPages[nodeId as NodeId] = page;
        }
      });

      // Save back the cleaned data if we removed anything
      if (Object.keys(validPages).length !== Object.keys(parsed).length) {
        this.saveClientPages(branchName, validPages);
      }

      return validPages;
    } catch (error) {
      console.error("Failed to load client pages from localStorage:", error);
      return {};
    }
  }

  static saveClientPages(branchName: string, pages: StoredClientPages): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.setItem(key, JSON.stringify(pages));
    } catch (error) {
      console.error("Failed to save client pages to localStorage:", error);
    }
  }

  static addClientPage(
    branchName: string,
    nodeId: NodeId,
    page: Omit<StoredClientPage, "createdAt">
  ): void {
    if (!branchName?.trim()) {
      console.error("Branch name is required for adding client page");
      return;
    }

    if (!nodeId?.trim()) {
      console.error("Node ID is required for adding client page");
      return;
    }

    const pages = this.loadClientPages(branchName);
    pages[nodeId] = {
      ...page,
      createdAt: Date.now(),
    };
    this.saveClientPages(branchName, pages);
  }

  static removeClientPage(branchName: string, nodeId: NodeId): void {
    if (!branchName?.trim() || !nodeId?.trim()) {
      console.error(
        "Branch name and node ID are required for removing client page"
      );
      return;
    }

    const pages = this.loadClientPages(branchName);
    const { [nodeId]: removed, ...remainingPages } = pages;
    this.saveClientPages(branchName, remainingPages);
  }

  static updateClientPageData(
    branchName: string,
    nodeId: NodeId,
    pageData: PageData
  ): void {
    if (!branchName?.trim() || !nodeId?.trim()) {
      console.error(
        "Branch name and node ID are required for updating client page data"
      );
      return;
    }

    if (
      !pageData?.html ||
      !pageData?.frontmatter ||
      !pageData?.originalElements
    ) {
      console.error("Complete page data is required for updating client page");
      return;
    }

    const pages = this.loadClientPages(branchName);
    if (pages[nodeId]) {
      pages[nodeId].pageData = pageData;
      this.saveClientPages(branchName, pages);
    } else {
      console.warn(`Client page with node ID ${nodeId} not found for update`);
    }
  }

  static clearAllClientPages(branchName: string): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to clear client pages from localStorage:", error);
    }
  }

  // Get all branch names that have stored client pages (for cleanup)
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
