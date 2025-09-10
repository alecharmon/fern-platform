import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";

import {
  NavigationStorage,
  createNavigationLocalStorage,
} from "./NavigationStorage";
import {
  createCommitFromChanges,
  generateSimpleHash,
  handleCommitSuccess,
} from "./commitUtils";
import { loadAllPageData, loadPageData, savePageData } from "./mdxUtils";
import {
  buildClientFoundNodes,
  buildClientNodesByParent,
  buildPageDataFromSources,
  createDocsYmlUpdate,
  createMdxFilename,
  createNavigationEntry,
  extractPageTitle,
  findSectionTitle,
  loadClientPageData,
} from "./pageUtils";
import {
  BuildPageDataProps,
  BuildPageDataResult,
  ConfigChange,
  NavigationContext,
  PageChange,
  PageData,
  SectionWithHierarchy,
  StoredNavigationData,
} from "./types";

export interface NavigationSnapshot {
  clientNodes: Record<NodeId, FernNavigation.PageNode[]>;
  clientFoundNodes: Record<NodeId, FernNavigation.utils.Node.Found>;
  pageChanges: Map<string, PageChange>;
  configChanges: Map<string, ConfigChange>;
  hasChanges: boolean;
  committedFiles: Set<string>;
  branchName: string;
  version: number;
}

export class NavigationStore {
  private _branchName: string;
  private _pageChanges = new Map<string, PageChange>();
  private _configChanges = new Map<string, ConfigChange>();
  private _listeners = new Set<() => void>();
  private _data: StoredNavigationData;
  private _lastSnapshot: NavigationSnapshot | null = null;
  private _lastServerSnapshot: NavigationSnapshot | null = null;
  private _version = 0;

  private _cachedClientNodes: Record<NodeId, FernNavigation.PageNode[]> | null =
    null;
  private _cachedClientFoundNodes: Record<
    NodeId,
    FernNavigation.utils.Node.Found
  > | null = null;
  private _storage: NavigationStorage;

  constructor(branchName: string, storage?: NavigationStorage) {
    this._branchName = branchName;
    this._storage = storage || createNavigationLocalStorage();
    this._data = this._storage.getStore(branchName);
  }

  /** Get the branch name */
  get branchName(): string {
    return this._branchName;
  }

  /** Get a copy of all page changes */
  get pageChanges(): Map<string, PageChange> {
    return new Map(this._pageChanges);
  }

  /** Get a copy of all config changes */
  get configChanges(): Map<string, ConfigChange> {
    return new Map(this._configChanges);
  }

  private _updateStorage(updates: Partial<StoredNavigationData>): void {
    this._storage.updateStore(this._branchName, updates);
    this._data = { ...this._data, ...updates };
  }

  private _clearCaches(): void {
    this._cachedClientNodes = null;
    this._cachedClientFoundNodes = null;
  }

  /** Load page data for a specific file */
  loadPageData(filename: string): PageData | undefined {
    return loadPageData(this._data, filename);
  }

  /** Load all page data */
  loadAllPageData(): Record<string, PageData> {
    return loadAllPageData(this._data);
  }

  /** Save page data updates to storage */
  savePageData(pageDataUpdates: Record<string, PageData>): void {
    const updatedData = savePageData(this._data, pageDataUpdates);
    this._updateStorage(updatedData);
  }

  /** Build page data from source files */
  buildPageDataFromSources(props: BuildPageDataProps): BuildPageDataResult {
    return buildPageDataFromSources(this._data, props);
  }

  /** Load client page data for a node */
  loadClientPageData(nodeId: NodeId) {
    return {
      ...loadClientPageData(this._data, nodeId),
      removeClientNodeWithUpdate: (pagePath: string, nodeId: NodeId) =>
        this.removeClientNodeWithUpdate(pagePath, nodeId),
    };
  }

  /** Load client nodes grouped by parent */
  loadClientNodes(): Record<NodeId, FernNavigation.PageNode[]> {
    if (!this._cachedClientNodes) {
      this._cachedClientNodes = buildClientNodesByParent(this._data);
    }
    return this._cachedClientNodes;
  }

  /** Load client found nodes */
  loadClientFoundNodes(): Record<NodeId, FernNavigation.utils.Node.Found> {
    if (!this._cachedClientFoundNodes) {
      this._cachedClientFoundNodes = buildClientFoundNodes(this._data);
    }
    return this._cachedClientFoundNodes;
  }

  /** Subscribe to store changes (useSyncExternalStore) */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    this._version++;
    this._lastSnapshot = null;
    this._clearCaches();
    this._listeners.forEach((listener) => listener());
  }

  private _persist(): void {
    this._storage.setStore(this._branchName, this._data);
  }

  private _updatePageState(
    operation: "create" | "update" | "delete",
    nodeId: NodeId,
    data?: {
      parentNodeId?: NodeId;
      node?: FernNavigation.PageNode;
      sidebar?: FernNavigation.SidebarRootNode;
      pageData?: PageData;
      fullSlug?: string;
      navigationContext?: NavigationContext;
      originalSection?: SectionWithHierarchy;
    }
  ): void {
    const existingPage = this._data.clientPages[nodeId];

    if (operation !== "create" && !existingPage) {
      console.warn(`Page with nodeId ${nodeId} not found for ${operation}`);
      return;
    }

    const fullSlug =
      operation === "create"
        ? data?.fullSlug || data?.node?.slug || ""
        : existingPage?.fullSlug || "";
    const filename = createMdxFilename(fullSlug);
    const pageData =
      operation === "delete"
        ? undefined
        : data?.pageData || existingPage?.pageData;

    // Update client pages
    if (operation === "create" && data?.node && data.parentNodeId != null) {
      this._data.clientPages[nodeId] = {
        node: data.node,
        parentNodeId: data.parentNodeId,
        sidebar: data.sidebar,
        pageData,
        fullSlug,
        navigationContext: data.navigationContext,
        createdAt: Date.now(),
      };
    } else if (operation === "update" && existingPage && pageData) {
      this._data.clientPages[nodeId] = { ...existingPage, pageData };
    } else if (operation === "delete") {
      const { [nodeId]: _, ...updatedClientPages } = this._data.clientPages;
      this._data.clientPages = updatedClientPages;
    }

    // Track page changes
    if (pageData || operation === "delete") {
      this._pageChanges.set(filename, {
        type: operation,
        filename,
        nodeId,
        ...(pageData && { pageData }),
      });
    }

    // Handle docs.yml updates
    if (
      operation === "create" &&
      pageData &&
      fullSlug &&
      data?.node &&
      data.parentNodeId != null
    ) {
      const pageTitle = extractPageTitle(pageData, data.node);
      const pageEntry = createNavigationEntry(pageTitle, filename);

      // Extract tab information if we're in a tabbed navigation
      const tabSlug =
        data.navigationContext?.currentTab?.type === "tab"
          ? (data.navigationContext.currentTab as any).slug
          : undefined;

      // For unnamed sections, pages should be added directly to navigation root
      // For named sections, they should be grouped under a section
      const isUnnamedSection = data.originalSection?.isUnnamed === true;

      const sectionTitle: string | null = isUnnamedSection
        ? null
        : data.originalSection?.title ||
          (data.sidebar?.children
            ? findSectionTitle(data.sidebar.children, data.parentNodeId) ||
              "Pages"
            : "Pages");

      this._data.docsYmlState.pendingUpdates[filename] = createDocsYmlUpdate(
        sectionTitle,
        pageEntry,
        "add",
        tabSlug
      );
      this._configChanges.set(filename, {
        type: "add_page",
        sectionTitle,
        tabSlug,
        pageEntry,
      });
    } else if (operation === "delete" && existingPage) {
      const pageTitle = existingPage.node.title || "";
      this._data.docsYmlState.pendingUpdates[filename] = {
        sectionTitle: "",
        pageEntry: { page: pageTitle, path: filename },
        createdAt: Date.now(),
        operation: "remove",
      };
      this._configChanges.set(filename, {
        type: "remove_page",
        pageEntry: { page: pageTitle, path: filename },
      });
    }

    this._persist();
    this._notify();
  }

  /** Create a new page */
  createPage(
    parentNodeId: NodeId,
    node: FernNavigation.PageNode,
    sidebar?: FernNavigation.SidebarRootNode,
    pageData?: PageData,
    fullSlug?: string,
    navigationContext?: NavigationContext,
    originalSection?: SectionWithHierarchy
  ): void {
    this._updatePageState("create", node.id, {
      parentNodeId,
      node,
      sidebar,
      pageData,
      fullSlug,
      navigationContext,
      originalSection,
    });
  }

  /** Update an existing page */
  updatePage(nodeId: NodeId, pageData: PageData): void {
    this._updatePageState("update", nodeId, { pageData });
  }

  /** Delete a page */
  deletePage(nodeId: NodeId): void {
    this._updatePageState("delete", nodeId);
  }

  /** Reset store to persisted state */
  reset(): void {
    this._data = this._storage.getStore(this._branchName); // Reload from storage
    this._pageChanges.clear();
    this._configChanges.clear();
    this._notify();
  }

  /** Prepare commit data from changes */
  prepareCommit(changedMdxFiles?: Record<string, string>): {
    changedFiles: Record<string, string>;
    deletedFiles: string[];
    docsYmlContent?: string;
  } {
    return createCommitFromChanges(
      this._pageChanges,
      this._configChanges,
      this._data,
      changedMdxFiles
    );
  }

  /** Check if changes are already committed */
  isCommitted(changedMdxFiles?: Record<string, string>): boolean {
    const { changedFiles } = this.prepareCommit(changedMdxFiles);
    const hasChanges = Object.keys(changedFiles).length > 0;

    if (!hasChanges) return false;

    const currentHash = generateSimpleHash(changedFiles);
    const lastCommittedHash = this._data.lastCommittedHash;

    return (
      lastCommittedHash != null &&
      currentHash === lastCommittedHash &&
      currentHash !== "0"
    );
  }

  /** Clear all tracked changes */
  clearChanges(): void {
    // Update committed files before clearing changes
    this._pageChanges.forEach((change) => {
      if (change.type === "delete") {
        this._data.committedFiles.delete(change.filename);
      } else {
        this._data.committedFiles.add(change.filename);
      }
    });

    this._pageChanges.clear();
    this._configChanges.clear();
    this._data.docsYmlState.pendingUpdates = {};

    this._persist();
    this._notify();
  }

  /** Get set of committed files */
  getCommittedFiles(): Set<string> {
    return new Set(this._data.committedFiles);
  }

  /** Set base docs.yml content */
  setDocsYmlBaseContent(content: string): void {
    this._data.docsYmlState.baseContent = content;
    this._data.docsYmlState.lastFetched = Date.now();
    this._persist();
  }

  /** Check if store has pending changes */
  hasChanges(): boolean {
    return this._pageChanges.size > 0 || this._configChanges.size > 0;
  }

  /** Get current snapshot of store state (useSyncExternalStore) */
  getSnapshot(): NavigationSnapshot {
    if (this._lastSnapshot?.version === this._version) {
      return this._lastSnapshot;
    }

    this._lastSnapshot = {
      clientNodes: this.loadClientNodes(),
      clientFoundNodes: this.loadClientFoundNodes(),
      pageChanges: this.pageChanges,
      configChanges: this.configChanges,
      hasChanges: this.hasChanges(),
      committedFiles: this.getCommittedFiles(),
      branchName: this.branchName,
      version: this._version,
    };

    return this._lastSnapshot;
  }

  /** Get server-side snapshot (useSyncExternalStore) */
  getServerSnapshot(): NavigationSnapshot {
    if (!this._lastServerSnapshot) {
      this._lastServerSnapshot = {
        clientNodes: {},
        clientFoundNodes: {},
        pageChanges: new Map<string, PageChange>(),
        configChanges: new Map<string, ConfigChange>(),
        hasChanges: false,
        committedFiles: new Set<string>(),
        branchName: this._branchName,
        version: 0,
      };
    }
    return this._lastServerSnapshot;
  }

  /** Remove client node and update docs.yml */
  removeClientNodeWithUpdate(pagePath: string, nodeId: NodeId): void {
    this._data.docsYmlState.pendingUpdates[pagePath] = {
      sectionTitle: "",
      pageEntry: { page: "", path: pagePath },
      createdAt: Date.now(),
      operation: "remove",
    };
    this.deletePage(nodeId);
  }

  /** Handle successful commit */
  handleCommitSuccess(allFilesToCommit: Record<string, string>): void {
    const updatedData = handleCommitSuccess(allFilesToCommit);
    this._updateStorage(updatedData);
    this.clearChanges();
  }
}
