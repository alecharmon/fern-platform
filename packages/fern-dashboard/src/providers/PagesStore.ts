import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";
import {
  BuildPageDataProps,
  BuildPageDataResult,
  NavigationContext,
  NavigationStore,
  PageData,
  SectionWithHierarchy,
} from "@fern-docs/components";
import { ChangedNodes, MdxToHtmlResponse, htmlToMdx } from "@fern-docs/mdx";

import {
  compareFrontmatter,
  createPageContents,
  createPageEntry,
  createPageKey,
  createPageMetadata,
} from "../utils/pagesStoreUtils";
import { SaveEvent } from "./types";

type Filename = string;

export interface PageMetadata {
  title?: string;
  subtitle?: string;
  slug?: string;
  [key: string]: unknown;
}

export interface PageContents {
  html: string;
  mdx?: string;
  originalFrontmatter?: MdxToHtmlResponse["frontmatter"];
}

export interface PageDependencies {
  frontmatter: PageMetadata;
  changedNodes?: ChangedNodes;
  changedFrontmatter?: boolean;
  changed?: boolean;
  syncedStatus?: "STAGED" | "SYNCING" | "SYNCED" | "ERROR";
}

export interface PagesStoreEntry {
  metadata: PageMetadata;
  contents: PageContents;
  dependencies: PageDependencies;
}

export interface PagesSnapshot {
  pages: Record<Filename, PagesStoreEntry>;
  changedMdxFiles: Record<Filename, string>;
  allMdxFiles: Record<Filename, string>;
  frontmatterData: Record<Filename, PageMetadata>;
  syncedStatus: Record<Filename, string>;
  clientNodes: Record<NodeId, FernNavigation.PageNode[]>;
  version: number;
}

export class PagesStore {
  private _pages: Record<Filename, PagesStoreEntry> = {};
  private _navigationStore: NavigationStore | null = null;
  private _listeners = new Set<() => void>();
  private _initialFrontmatter: Record<string, PageMetadata> = {};
  private _lastSnapshot: PagesSnapshot | null = null;
  private _lastServerSnapshot: PagesSnapshot | null = null;
  private _version = 0;
  private _initializedPages = new Set<string>();
  private _saveEventListeners = new Set<(event: SaveEvent) => void>();

  constructor(navigationStore?: NavigationStore) {
    this._navigationStore = navigationStore || null;
  }

  /** Get the associated NavigationStore instance */
  get navigationStore(): NavigationStore | null {
    return this._navigationStore;
  }

  /** Set the NavigationStore instance */
  setNavigationStore(navigationStore: NavigationStore): void {
    this._navigationStore = navigationStore;
  }

  /** Get all page entries */
  get pages(): Record<Filename, PagesStoreEntry> {
    return this._pages;
  }

  /** Subscribe to store changes (useSyncExternalStore) */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Subscribe to save events */
  subscribeSaveEvent(listener: (event: SaveEvent) => void): () => void {
    this._saveEventListeners.add(listener);
    return () => this._saveEventListeners.delete(listener);
  }

  /** Emit a save event to all listeners */
  emitSaveEvent(event: SaveEvent): void {
    this._saveEventListeners.forEach((listener) => listener(event));
  }

  private _notify(): void {
    this._version++;
    this._lastSnapshot = null;
    this._listeners.forEach((listener) => listener());
  }

  private _requireNavigationStore(): NavigationStore {
    if (!this._navigationStore) {
      throw new Error("NavigationStore not available");
    }
    return this._navigationStore;
  }

  private _computeChangedMdxFiles(): Record<Filename, string> {
    const result: Record<Filename, string> = {};

    // Include changed files from internal state
    Object.entries(this._pages).forEach(([filename, page]) => {
      if (page.dependencies.changed && page.contents.mdx) {
        result[filename] = page.contents.mdx;
      }
    });

    // Also include persisted data from NavigationStore that isn't already in internal state
    // TODO: NavigationStore should store mdx content instead of html
    if (this._navigationStore) {
      const persistedData = this._navigationStore.loadAllPageData();
      Object.entries(persistedData).forEach(([filename, pageData]) => {
        if (!this._pages[filename]) {
          try {
            const { mdx: mdxContent } = htmlToMdx(
              pageData.html,
              pageData.frontmatter
            );
            result[filename] = mdxContent;
          } catch (error) {
            console.error(
              `Failed to generate MDX for persisted file ${filename}:`,
              error
            );
          }
        }
      });
    }

    return result;
  }

  private _computeAllMdxFiles(): Record<Filename, string> {
    const result: Record<Filename, string> = {};
    Object.entries(this._pages).forEach(([filename, page]) => {
      if (page.contents.mdx) {
        result[filename] = page.contents.mdx;
      }
    });
    return result;
  }

  private _computeFrontmatterData(): Record<Filename, PageMetadata> {
    const result: Record<Filename, PageMetadata> = {};
    Object.entries(this._pages).forEach(([filename, page]) => {
      result[filename] = page.dependencies.frontmatter;
    });
    return result;
  }

  private _computeSyncedStatus(): Record<Filename, string> {
    const result: Record<Filename, string> = {};
    Object.entries(this._pages).forEach(([filename, page]) => {
      result[filename] = page.dependencies.syncedStatus || "SYNCED";
    });
    return result;
  }

  /** Get all changed MDX files */
  loadChangedMdxFiles(): Record<Filename, string> {
    return this._computeChangedMdxFiles();
  }

  /** Get all MDX files */
  getAllMdxFiles(): Record<Filename, string> {
    return this._computeAllMdxFiles();
  }

  /** Get frontmatter data for all pages */
  getFrontmatterData(): Record<Filename, PageMetadata> {
    return this._computeFrontmatterData();
  }

  /** Get sync status for all pages */
  getSyncedStatus(): Record<Filename, string> {
    return this._computeSyncedStatus();
  }

  /** Create a new page in both stores */
  createPage(
    parentNodeId: NodeId,
    node: FernNavigation.PageNode,
    sidebar?: FernNavigation.SidebarRootNode,
    pageData?: PageData,
    fullSlug?: string,
    navigationContext?: NavigationContext,
    initialContent?: string,
    originalSection?: SectionWithHierarchy
  ): void {
    this._requireNavigationStore().createPage(
      parentNodeId,
      node,
      sidebar,
      pageData,
      fullSlug,
      navigationContext,
      originalSection
    );

    const filename = `${fullSlug || node.slug}.mdx`;
    const html = pageData?.html || initialContent || "";
    const frontmatter = pageData?.frontmatter || { title: node.title };
    const { mdx: mdxContent } = htmlToMdx(html, frontmatter);

    const pageEntry = createPageEntry(
      createPageMetadata(frontmatter),
      createPageContents(html, undefined, mdxContent),
      { changed: true, syncedStatus: "STAGED" }
    );

    this.setPage(filename, pageEntry);
  }

  /** Prepare commit data for changed files */
  prepareCommit(changedMdxFiles: Record<string, string>) {
    return this._requireNavigationStore().prepareCommit(changedMdxFiles);
  }

  /** Check if files are already committed */
  isCommitted(changedMdxFiles: Record<string, string>): boolean {
    return this._requireNavigationStore().isCommitted(changedMdxFiles);
  }

  /** Handle successful commit */
  handleCommitSuccess(committedFiles: Record<string, string>): void {
    this._requireNavigationStore().handleCommitSuccess(committedFiles);
    this.clearCommittedChanges();
  }

  /** Set base docs.yml content */
  setDocsYmlBaseContent(content: string): void {
    this._requireNavigationStore().setDocsYmlBaseContent(content);
  }

  /** Build page data from source files */
  buildPageDataFromSources(props: BuildPageDataProps): BuildPageDataResult {
    return this._requireNavigationStore().buildPageDataFromSources(props);
  }

  /** Load client navigation nodes */
  loadClientNodes(): Record<NodeId, FernNavigation.PageNode[]> {
    return this._navigationStore?.loadClientNodes() || {};
  }

  /** Update page dependencies */
  updateDependencies(
    filename: Filename,
    updates: Partial<PageDependencies>
  ): void {
    const existing = this._pages[filename];
    if (!existing) {
      console.warn(`Page ${filename} not found for dependency update`);
      return;
    }

    if (updates.frontmatter && !this._initialFrontmatter[filename]) {
      this._initialFrontmatter[filename] = { ...updates.frontmatter };
    }

    const mergedFrontmatter = updates.frontmatter
      ? { ...existing.dependencies.frontmatter, ...updates.frontmatter }
      : existing.dependencies.frontmatter;

    const changedFrontmatter = updates.frontmatter
      ? !compareFrontmatter(
          updates.frontmatter,
          this._initialFrontmatter[filename] || {}
        )
      : existing.dependencies.changedFrontmatter;

    this._pages[filename] = {
      ...existing,
      dependencies: {
        ...existing.dependencies,
        frontmatter: mergedFrontmatter,
        changedNodes: {
          ...existing.dependencies.changedNodes,
          ...updates.changedNodes,
        },
        changedFrontmatter,
        changed: updates.changed ?? existing.dependencies.changed,
        syncedStatus:
          updates.syncedStatus ?? existing.dependencies.syncedStatus,
      },
    };

    this._notify();
  }
  /** Update page content and dependencies */
  updatePage(
    filename: Filename,
    updates: Partial<PageDependencies> & {
      html?: string;
      originalFrontmatter?: MdxToHtmlResponse["frontmatter"];
    }
  ): void {
    this.updateDependencies(filename, {
      ...updates,
      changed: true,
      syncedStatus: "STAGED",
    });

    const existingPage = this._pages[filename];

    if (
      existingPage &&
      (updates.html || updates.originalFrontmatter || updates.frontmatter)
    ) {
      const updatedContents = {
        ...existingPage.contents,
        ...(updates.html && { html: updates.html }),
        ...(updates.originalFrontmatter && {
          originalFrontmatter: updates.originalFrontmatter,
        }),
      };

      // Regenerate MDX when HTML changes or frontmatter changes
      if (updates.html || updates.frontmatter) {
        try {
          const { mdx: newMdx } = htmlToMdx(
            updatedContents.html,
            existingPage.dependencies.frontmatter,
            undefined,
            existingPage.dependencies.changedNodes
          );
          updatedContents.mdx = newMdx;
        } catch (error) {
          console.error(
            "[PagesStore.updatePage] Failed to generate MDX from HTML:",
            error
          );
        }
      }

      this._pages[filename] = { ...existingPage, contents: updatedContents };
    }

    this.persistToStorage();
    this._notify();
  }

  /** Set a page entry directly */
  setPage(filename: Filename, page: PagesStoreEntry): void {
    this._pages[filename] = page;
    this._notify();
  }

  /** Remove a page */
  removePage(filename: Filename): void {
    const { [filename]: _, ...updatedPages } = this._pages;
    const { [filename]: __, ...updatedFrontmatter } = this._initialFrontmatter;

    this._pages = updatedPages;
    this._initialFrontmatter = updatedFrontmatter;
    this._notify();
  }

  /** Get a specific page entry */
  getPage(filename: Filename): PagesStoreEntry | undefined {
    return this._pages[filename];
  }

  /** Check if page exists */
  hasPage(filename: Filename): boolean {
    return filename in this._pages;
  }

  /** Clear all pages */
  clear(): void {
    this._pages = {};
    this._initialFrontmatter = {};
    this._notify();
  }

  /** Get current snapshot of store state (useSyncExternalStore) */
  getSnapshot(): PagesSnapshot {
    if (this._lastSnapshot?.version === this._version) {
      return this._lastSnapshot;
    }

    this._lastSnapshot = {
      pages: this._pages,
      changedMdxFiles: this._computeChangedMdxFiles(),
      allMdxFiles: this._computeAllMdxFiles(),
      frontmatterData: this._computeFrontmatterData(),
      syncedStatus: this._computeSyncedStatus(),
      clientNodes: this.loadClientNodes(),
      version: this._version,
    };

    return this._lastSnapshot;
  }

  /** Get server-side snapshot (useSyncExternalStore) */
  getServerSnapshot(): PagesSnapshot {
    if (!this._lastServerSnapshot) {
      this._lastServerSnapshot = {
        pages: {},
        changedMdxFiles: {},
        allMdxFiles: {},
        frontmatterData: {},
        syncedStatus: {},
        clientNodes: {},
        version: 0,
      };
    }
    return this._lastServerSnapshot;
  }

  /** Initialize a page with default content */
  initializePage(
    filename: string,
    clientNodeId: NodeId | undefined,
    initialHtml: MdxToHtmlResponse["html"],
    initialFrontmatter: MdxToHtmlResponse["frontmatter"],
    initialOriginalFrontmatter: MdxToHtmlResponse["originalFrontmatter"]
  ): void {
    const pageKey = createPageKey(filename, clientNodeId);
    if (this._initializedPages.has(pageKey)) return;

    // Check for saved data in NavigationStore first
    let htmlToUse = initialHtml;
    let frontmatterToUse = initialFrontmatter;
    const originalFrontmatterToUse = initialOriginalFrontmatter;
    let hasChanges = false;
    let mdxContent: string | undefined;

    if (this._navigationStore) {
      const savedPageData = this._navigationStore.loadPageData(filename);
      if (savedPageData) {
        htmlToUse = savedPageData.html;
        frontmatterToUse = savedPageData.frontmatter;
        hasChanges = true;
      }
    }

    // Always generate MDX content for all pages to ensure they're included in allMdxFiles
    try {
      mdxContent = htmlToMdx(htmlToUse, frontmatterToUse).mdx;
    } catch (error) {
      console.error(
        "Failed to generate MDX during page initialization:",
        error
      );
    }

    const existingPage = this._pages[filename];
    const pageEntry = createPageEntry(
      createPageMetadata(frontmatterToUse),
      createPageContents(htmlToUse, originalFrontmatterToUse, mdxContent),
      {
        changed: hasChanges,
        syncedStatus: hasChanges ? "STAGED" : "SYNCED",
        ...(existingPage?.dependencies || {}),
      }
    );

    this.setPage(filename, pageEntry);
    this._initializedPages.add(pageKey);
  }

  /** Apply MDX content changes to a page */
  applyPageChange(filename: string, changedMdxContent?: string): void {
    if (!changedMdxContent) return;

    const existingPage = this._pages[filename];
    if (existingPage) {
      this._pages[filename] = {
        ...existingPage,
        contents: { ...existingPage.contents, mdx: changedMdxContent },
        dependencies: { ...existingPage.dependencies, changed: true },
      };
    } else {
      const fallbackTitle = filename.replace(".mdx", "");
      this._pages[filename] = createPageEntry(
        createPageMetadata({}, fallbackTitle),
        createPageContents("", undefined, changedMdxContent),
        { changed: true, syncedStatus: "SYNCED" }
      );
    }
    this._notify();
  }

  /** Clear committed changes from all pages */
  clearCommittedChanges(): void {
    Object.keys(this._pages).forEach((filename) => {
      const page = this._pages[filename];
      if (page?.dependencies.changed) {
        this._pages[filename] = {
          ...page,
          dependencies: {
            ...page.dependencies,
            changed: false,
            syncedStatus: "SYNCED",
          },
        };
      }
    });

    this._notify();
  }

  /** Persist changes to storage */
  persistToStorage(): void {
    if (!this._navigationStore) return;

    try {
      const changedMdxFiles: Record<string, string> = {};
      const pageDataUpdates: Record<string, PageData> = {};

      Object.entries(this._pages).forEach(([filename, page]) => {
        if (page.dependencies.changed) {
          if (page.contents.mdx) {
            changedMdxFiles[filename] = page.contents.mdx;
          }
          pageDataUpdates[filename] = {
            html: page.contents.html,
            frontmatter: page.dependencies.frontmatter,
          };
        }
      });

      if (Object.keys(changedMdxFiles).length > 0) {
        this._navigationStore.savePageData(pageDataUpdates);
      }
    } catch (error) {
      console.error("Failed to persist changes via NavigationStore:", error);
    }
  }
}
