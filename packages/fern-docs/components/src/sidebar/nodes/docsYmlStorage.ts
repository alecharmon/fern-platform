import type {
  DocsYmlPageEntry,
  DocsYmlState,
  DocsYmlUpdate,
} from "./docsYmlTypes";

export class DocsYmlStorage {
  private static readonly STORAGE_KEY_PREFIX = "fern-docs-yml-state";

  static getStorageKey(branchName: string): string {
    return `${this.STORAGE_KEY_PREFIX}-${branchName}`;
  }

  static loadState(branchName: string): DocsYmlState | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const key = this.getStorageKey(branchName);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored) as DocsYmlState;

      // Clean up old updates (older than 7 days)
      const now = Date.now();
      const weekInMs = 7 * 24 * 60 * 60 * 1000;
      const validUpdates: Record<string, DocsYmlUpdate> = {};

      Object.entries(parsed.updates || {}).forEach(([pagePath, update]) => {
        if (update.createdAt && now - update.createdAt < weekInMs) {
          validUpdates[pagePath] = update;
        }
      });

      const cleanedState: DocsYmlState = {
        baseContent: parsed.baseContent || "",
        updates: validUpdates,
        lastFetched: parsed.lastFetched || 0,
      };

      // Save back the cleaned data if we removed anything
      if (
        Object.keys(validUpdates).length !==
        Object.keys(parsed.updates || {}).length
      ) {
        this.saveState(branchName, cleanedState);
      }

      return cleanedState;
    } catch (error) {
      console.error("Failed to load docs.yml state from localStorage:", error);
      return null;
    }
  }

  static saveState(branchName: string, state: DocsYmlState): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save docs.yml state to localStorage:", error);
    }
  }

  static setBaseContent(branchName: string, content: string): void {
    if (!branchName?.trim()) {
      console.error("Branch name is required for setting base content");
      return;
    }

    const existingState = this.loadState(branchName);
    const newState: DocsYmlState = {
      baseContent: content,
      updates: existingState?.updates || {},
      lastFetched: Date.now(),
    };
    this.saveState(branchName, newState);
  }

  static addUpdate(
    branchName: string,
    sectionTitle: string,
    pageEntry: DocsYmlPageEntry
  ): void {
    if (!branchName?.trim() || !pageEntry.path?.trim()) {
      console.error(
        "Branch name and page path are required for adding docs.yml update"
      );
      return;
    }

    const state = this.loadState(branchName);
    if (!state) {
      console.warn(
        "No base content found for branch. Call setBaseContent first."
      );
      return;
    }

    const newState: DocsYmlState = {
      ...state,
      updates: {
        ...state.updates,
        [pageEntry.path]: {
          sectionTitle,
          pageEntry,
          createdAt: Date.now(),
          operation: "add",
        },
      },
    };
    this.saveState(branchName, newState);
  }

  static addRemovalUpdate(branchName: string, pagePath: string): void {
    if (!branchName?.trim() || !pagePath?.trim()) {
      console.error(
        "Branch name and page path are required for adding removal update"
      );
      return;
    }

    const state = this.loadState(branchName);
    if (!state) {
      console.warn(
        "No base content found for branch. Call setBaseContent first."
      );
      return;
    }

    const newState: DocsYmlState = {
      ...state,
      updates: {
        ...state.updates,
        [pagePath]: {
          sectionTitle: "", // Not needed for removal
          pageEntry: { page: "", path: pagePath },
          createdAt: Date.now(),
          operation: "remove",
        },
      },
    };
    this.saveState(branchName, newState);
  }

  static removeUpdate(branchName: string, pagePath: string): void {
    if (!branchName?.trim() || !pagePath?.trim()) {
      console.error(
        "Branch name and page path are required for removing docs.yml update"
      );
      return;
    }

    const state = this.loadState(branchName);
    if (!state) return;

    const { [pagePath]: removed, ...remainingUpdates } = state.updates;
    const newState: DocsYmlState = {
      ...state,
      updates: remainingUpdates,
    };
    this.saveState(branchName, newState);
  }

  static getFinalContent(branchName: string): string | null {
    const state = this.loadState(branchName);
    if (!state?.baseContent) {
      return null;
    }

    // If no updates, return base content
    if (Object.keys(state.updates).length === 0) {
      return state.baseContent;
    }

    // For components package, just return base content and warn
    console.warn(
      "getFinalContent called but updates cannot be applied in components package. Use getFinalContentWithUpdater instead."
    );
    return state.baseContent;
  }

  static getFinalContentWithUpdater(
    branchName: string,
    addPageToDocsYmlFn: (
      content: string,
      sectionTitle: string,
      pageEntry: any
    ) => string,
    removePageFromDocsYmlFn?: (content: string, pagePath: string) => string
  ): string | null {
    const state = this.loadState(branchName);
    if (!state?.baseContent) {
      return null;
    }

    // If no updates, return base content
    if (Object.keys(state.updates).length === 0) {
      return state.baseContent;
    }

    // Apply all updates to the base content
    try {
      let updatedContent = state.baseContent;

      // Sort updates by creation time to apply them in chronological order
      const sortedUpdates = Object.values(state.updates).sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
      );

      sortedUpdates.forEach((update) => {
        const operation = update.operation || "add"; // Default to "add" for backward compatibility

        if (operation === "add") {
          updatedContent = addPageToDocsYmlFn(
            updatedContent,
            update.sectionTitle,
            update.pageEntry
          );
        } else if (operation === "remove" && removePageFromDocsYmlFn) {
          updatedContent = removePageFromDocsYmlFn(
            updatedContent,
            update.pageEntry.path || ""
          );
        }
      });

      return updatedContent;
    } catch (error) {
      console.error("Error applying docs.yml updates:", error);
      return state.baseContent; // Return base content if updates fail
    }
  }

  static hasUpdates(branchName: string): boolean {
    const state = this.loadState(branchName);
    return state ? Object.keys(state.updates).length > 0 : false;
  }

  static clearAllUpdates(branchName: string): void {
    const state = this.loadState(branchName);
    if (!state) return;

    const newState: DocsYmlState = {
      ...state,
      updates: {},
    };
    this.saveState(branchName, newState);
  }

  static clearAll(branchName: string): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const key = this.getStorageKey(branchName);
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to clear docs.yml state from localStorage:", error);
    }
  }

  // Get all branch names that have stored docs.yml state (for cleanup)
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
