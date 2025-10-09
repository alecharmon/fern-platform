import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { type ChangedNodes, type Frontmatter, htmlToMdx, mdxToHtml } from "@fern-docs/mdx";
import {
    computeStateHash,
    type FilenameToContent,
    formatCommitFiles,
    type GitCommitFile,
    hasChangesToCommit
} from "./commitUtils";
import { generateFractionalIndex } from "./indexingUtils";
import { createNavigationBufferedIndexedDBStorage, type NavigationStorage } from "./NavigationStorage";
import { resolvePageData } from "./pageUtils";
import type {
    ClientPageDataWriteDependencies,
    DeletionToastCallback,
    DocsYmlBaseContent,
    DocsYmlChange,
    DocsYmlChanges,
    NavigationSnapshot,
    PageData,
    PageDataDependencies,
    PageFilename,
    PageRegistry,
    PageRegistryEntry,
    PageSaveEvent,
    ResolvedPageData,
    SectionAncestorMetadata,
    SerializableFoundNode
} from "./types";
import { createEmptyNavigationSnapshot } from "./types";
import { buildDocsYmlFromChanges } from "./ymlUtils";

export class NavigationStore {
    private _branchName: string;
    private _orgName: string;
    private _docsUrl: string;
    private _latestSnapshot: NavigationSnapshot;
    private _serverSnapshot: NavigationSnapshot | null = null;

    private _pageRegistry: PageRegistry;
    private _docsYmlBaseContent: DocsYmlBaseContent;
    private _docsYmlChanges: DocsYmlChanges;
    private _lastCommittedHash?: string;
    private _version: number;

    private _storage?: NavigationStorage;
    private _hydrated = false;
    private _hydrationPromise?: Promise<void>;
    private _deletionToastCallback?: DeletionToastCallback;

    private _listeners = new Set<() => void>();
    private _pageSaveEventListeners = new Set<(event: PageSaveEvent) => void>();

    constructor(branchName: string, orgName: string, docsUrl: string) {
        this._branchName = branchName;
        this._orgName = orgName;
        this._docsUrl = docsUrl;
        this._latestSnapshot = createEmptyNavigationSnapshot(branchName, orgName, docsUrl);

        this._pageRegistry = this._latestSnapshot.pageRegistry;
        this._docsYmlBaseContent = this._latestSnapshot.docsYmlBaseContent;
        this._docsYmlChanges = this._latestSnapshot.docsYmlChanges;
        this._lastCommittedHash = this._latestSnapshot.lastCommittedHash;
        this._version = this._latestSnapshot.version;
    }

    // GETTERS
    // --------------------------------------------------------------------------

    /** Returns the branch name */
    get branchName(): string {
        return this._branchName;
    }

    /** Get the org name */
    get orgName(): string {
        return this._orgName;
    }

    /** Get the docs url */
    get docsUrl(): string {
        return this._docsUrl;
    }

    /** Returns pages from the registry */
    get registeredPages(): PageRegistry {
        return this._pageRegistry;
    }

    /** Returns whether the store has been hydrated */
    get hydrated(): boolean {
        return this._hydrated;
    }

    /** Returns all changed, deleted, and commit-ready files */
    get files(): {
        changed: FilenameToContent;
        deleted: string[];
        forCommit: GitCommitFile[];
        hasChangesToCommit: boolean;
    } {
        const changedFiles: FilenameToContent = {};
        const deletedFiles: string[] = [];

        Object.entries(this._pageRegistry).forEach(([filename, entry]) => {
            if (entry.status === "changed" && entry.pageData.mdx) {
                changedFiles[filename] = entry.pageData.mdx;
            }
            if (entry.isMarkedForDeletion) {
                deletedFiles.push(filename);
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete changedFiles[filename];
            }
        });

        this._docsYmlChanges.forEach((change, filename) => {
            if (change.type === "remove_page" && !deletedFiles.includes(filename)) {
                deletedFiles.push(filename);
            }
        });

        if (this._docsYmlChanges.size > 0) {
            try {
                changedFiles["docs.yml"] = buildDocsYmlFromChanges(this._latestSnapshot);
            } catch (error) {
                console.error("Failed to generate docs.yml:", error);
            }
        }

        return {
            changed: changedFiles,
            deleted: deletedFiles,
            forCommit: formatCommitFiles(changedFiles, deletedFiles),
            hasChangesToCommit: hasChangesToCommit(changedFiles, this._lastCommittedHash)
        };
    }

    // METHODS
    // --------------------------------------------------------------------------

    /** Lazily initializes storage, accounting for multiple concurrent hydration attempts */
    async hydrate(options?: { storage?: NavigationStorage; initialDocsYmlContent?: string | null }): Promise<void> {
        // If already hydrated, return immediately
        if (this._hydrated) {
            return;
        }

        // If hydration is in progress, wait for it to complete
        if (this._hydrationPromise) {
            return this._hydrationPromise;
        }

        // Start hydration
        this._hydrationPromise = this._doHydrate(options);
        try {
            await this._hydrationPromise;
        } finally {
            this._hydrationPromise = undefined;
        }
    }

    /** Initialize the store from storage */
    private async _doHydrate(options?: {
        storage?: NavigationStorage;
        initialDocsYmlContent?: string | null;
    }): Promise<void> {
        this._storage = options?.storage || createNavigationBufferedIndexedDBStorage();

        // Initialize storage and wait for it to complete
        await this._storage.init();

        // Only access storage after init is complete
        const storedSnapshot = this._storage.getOrSetStore(this._branchName, this._orgName, this._docsUrl);

        this._latestSnapshot = storedSnapshot;
        this._pageRegistry = storedSnapshot.pageRegistry;
        this._docsYmlBaseContent = storedSnapshot.docsYmlBaseContent ?? options?.initialDocsYmlContent ?? null;
        this._docsYmlChanges = storedSnapshot.docsYmlChanges;
        this._lastCommittedHash = storedSnapshot.lastCommittedHash;
        this._version = storedSnapshot.version;
        this._hydrated = true;

        this._setStorageAndNotify();
    }

    /** Set the deletion toast callback */
    setDeletionToastCallback(callback: DeletionToastCallback): void {
        this._deletionToastCallback = callback;
    }

    /** Resolves initial page data from dependencies */
    resolveInitialPageData(deps: PageDataDependencies): ResolvedPageData {
        return resolvePageData(this._latestSnapshot, deps);
    }

    /** Ensures page entry exists in registry (creates or updates it) */
    registerPage(pageData: ResolvedPageData): void {
        const existing = this._pageRegistry[pageData.filename];

        // Extract parent section ID from foundNode parents
        const parentSectionId = this._extractParentSectionId(pageData.foundNode);

        if (existing) {
            this._updatePageEntry(pageData.filename, {
                pageData: pageData,
                parentSectionId: existing.parentSectionId ?? parentSectionId
            });
        } else {
            // Store initial MDX when first registering the page
            this._createPageEntry(pageData.filename, {
                pageData: pageData,
                status: "unchanged",
                isMarkedForDeletion: false,
                lastModified: Date.now(),
                parentSectionId,
                initialMdx: pageData.mdx
            });
        }
    }

    /** Creates a new client page */
    createClientPage(filename: PageFilename, deps: ClientPageDataWriteDependencies): void {
        const { html, frontmatter } = mdxToHtml(deps.initialMdx);
        const title = String(frontmatter?.title ?? "");
        const slug = FernNavigation.Slug(String(frontmatter?.slug ?? ""));
        const indices = Object.values(this._pageRegistry)
            .map((entry) => entry.index)
            .filter((index): index is string => index != null);
        const newIndex = generateFractionalIndex(indices, "start");

        const parentSectionId =
            deps.targetSectionPath.length > 0
                ? deps.targetSectionPath[deps.targetSectionPath.length - 1]?.id
                : undefined;

        this._createPageEntry(filename, {
            pageData: {
                source: "client",
                filename: filename,
                mdx: deps.initialMdx,
                html: html,
                frontmatter: frontmatter,
                foundNode: {
                    ...deps.baseFoundNode,
                    node: {
                        type: "page",
                        id: FernNavigation.NodeId(`client-${Math.random().toString(36).substring(2, 15)}`),
                        pageId: FernNavigation.PageId(filename),
                        title: title,
                        slug: slug,
                        canonicalSlug: slug,
                        icon: undefined,
                        hidden: undefined,
                        authed: undefined,
                        viewers: undefined,
                        orphaned: undefined,
                        noindex: undefined,
                        featureFlags: undefined,
                        availability: undefined
                    }
                }
            },
            status: "changed",
            isMarkedForDeletion: false,
            lastModified: Date.now(),
            index: newIndex,
            parentSectionId,
            initialMdx: deps.initialMdx
        });

        this._docsYmlChanges.set(filename, {
            type: "add_page",
            sectionTitle: this._extractSectionTitle(deps.targetSectionPath),
            tabSlug: this._extractTabSlug(deps.baseFoundNode),
            pageEntry: { page: title, path: filename },
            createdAt: Date.now(),
            index: newIndex
        });

        this._setStorageAndNotify();
    }

    /** Updates page data and marks as changed */
    updatePage(filename: PageFilename, update: Partial<PageData>): void {
        this._updatePageEntry(filename, {
            pageData: { ...update },
            status: "changed"
        });
    }

    /** Updates page frontmatter by regenerating MDX */
    updatePageFrontmatter(filename: string, frontmatter: Partial<Frontmatter>): void {
        const { pageData } = this._getPageEntry(filename);
        const { mdx } = htmlToMdx(pageData.html, {
            frontmatter: { ...pageData.frontmatter, ...frontmatter }
        });
        this.updatePage(filename, { mdx });
    }

    /** Updates page HTML content by converting to MDX */
    updatePageHtml(filename: string, html: string, changedNodes?: ChangedNodes): void {
        const { pageData } = this._getPageEntry(filename);
        const { mdx } = htmlToMdx(html, {
            frontmatter: pageData.frontmatter,
            changedNodes
        });
        this.updatePage(filename, { mdx });
    }

    /** Resets a page to its initial state */
    resetPage(filename: PageFilename): void {
        const entry = this._pageRegistry[filename];
        if (!entry) {
            console.warn(`Cannot reset page: ${filename} not found in registry`);
            return;
        }

        // Check if we have initial MDX stored
        if (!entry.initialMdx) {
            console.warn(`Cannot reset page: ${filename} has no initial MDX stored`);
            return;
        }

        // For client pages, mark for deletion instead of reset
        if (entry.pageData.source === "client") {
            this.markPageForDeletion(filename);
            return;
        }

        // Remove from docs.yml changes if it was tracked there
        this._docsYmlChanges.delete(filename);

        // Restore the page to its initial state in a single update
        // This will recompute HTML and frontmatter from the initial MDX
        this._updatePageEntry(filename, {
            pageData: { mdx: entry.initialMdx },
            status: "unchanged"
        });

        // Emit page save event to notify editor components to update
        const updatedEntry = this._pageRegistry[filename];
        if (updatedEntry) {
            this.emitPageSaveEvent({
                filename: filename,
                frontmatter: updatedEntry.pageData.frontmatter || {},
                html: updatedEntry.pageData.html
            });
        }
    }

    /** Marks a page for deletion and tracks in docs.yml changes */
    markPageForDeletion(filename: PageFilename, pageTitle?: string): void {
        const entry = this._pageRegistry[filename];

        if (entry) {
            this._updatePageEntry(filename, { isMarkedForDeletion: true });
            this._docsYmlChanges.set(filename, {
                type: "remove_page",
                pageEntry: {
                    page: entry.pageData.foundNode.node.title,
                    path: filename
                },
                createdAt: Date.now()
            });

            // Show deletion toast with undo functionality
            if (this._deletionToastCallback) {
                this._deletionToastCallback(entry.pageData.foundNode.node.title, () =>
                    this.unmarkPageForDeletion(filename)
                );
            }
        } else if (pageTitle) {
            this._docsYmlChanges.set(filename, {
                type: "remove_page",
                pageEntry: { page: pageTitle, path: filename },
                createdAt: Date.now()
            });
            this._setStorageAndNotify();

            // Show deletion toast with undo functionality for server pages
            if (this._deletionToastCallback) {
                this._deletionToastCallback(pageTitle, () => this.unmarkPageForDeletion(filename));
            }
        } else {
            console.warn(`Cannot mark page ${filename} for deletion: page not found in registry and no title provided`);
        }
    }

    /** Unmarks a page for deletion and removes from docs.yml changes */
    unmarkPageForDeletion(filename: PageFilename): void {
        const entry = this._pageRegistry[filename];
        if (entry) {
            this._updatePageEntry(filename, { isMarkedForDeletion: false });

            // For client pages, we need to restore them as "add_page" changes
            // For server pages, we just remove the deletion change
            if (entry.pageData.source === "client") {
                // Restore client page as an "add_page" change
                const title = entry.pageData.foundNode.node.title;
                const targetSectionPath = this._reconstructTargetSectionPath(entry);

                this._docsYmlChanges.set(filename, {
                    type: "add_page",
                    sectionTitle: this._extractSectionTitle(targetSectionPath),
                    tabSlug: this._extractTabSlug(entry.pageData.foundNode),
                    pageEntry: { page: title, path: filename },
                    createdAt: Date.now(),
                    index: entry.index
                });
            } else {
                // For server pages, just remove the deletion change
                this._docsYmlChanges.delete(filename);
            }

            this._setStorageAndNotify();
        } else if (this._docsYmlChanges.has(filename)) {
            // Handle server pages that are not in the registry but have deletion changes
            // This occurs when markPageForDeletion was called with only pageTitle (server pages not in registry)
            this._docsYmlChanges.delete(filename);
            this._setStorageAndNotify();
        }
    }

    /** Handles successful commit by cleaning up changed and deleted pages */
    handleCommitSuccess(): void {
        Object.keys(this._pageRegistry).forEach((filename) => {
            const entry = this._pageRegistry[filename];
            if (!entry) return;

            if (entry.isMarkedForDeletion) {
                const { [filename]: _, ...rest } = this._pageRegistry;
                this._pageRegistry = rest;
            } else if (entry.status === "changed") {
                this._pageRegistry[filename] = { ...entry, status: "committed" };
            }
        });

        if (this.files.changed["docs.yml"]) {
            this._docsYmlBaseContent = this.files.changed["docs.yml"];
        }

        const deletionMarkers = new Map<string, DocsYmlChange>();
        this._docsYmlChanges.forEach((change, filename) => {
            if (change.type === "remove_page") {
                deletionMarkers.set(filename, change);
            }
        });
        this._docsYmlChanges.clear();
        deletionMarkers.forEach((change, filename) => {
            this._docsYmlChanges.set(filename, change);
        });

        // TODO: is this the right place to compute the hash?
        this._lastCommittedHash = computeStateHash(this.files.changed);
        this._setStorageAndNotify();
    }

    /** Emits a page save event to all listeners */
    emitPageSaveEvent(event: PageSaveEvent): void {
        this._pageSaveEventListeners.forEach((listener) => listener(event));
    }

    /** Subscribes to page save events */
    subscribePageSaveEvent(listener: (event: PageSaveEvent) => void): () => void {
        this._pageSaveEventListeners.add(listener);
        return () => this._pageSaveEventListeners.delete(listener);
    }

    // useSyncExternalStore
    // --------------------------------------------------------------------------

    /** Subscribes to store changes for useSyncExternalStore */
    subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /** Returns current snapshot for client-side rendering */
    getSnapshot(): NavigationSnapshot {
        return this._latestSnapshot;
    }

    /** Returns server-side snapshot for SSR */
    getServerSnapshot(): NavigationSnapshot {
        if (!this._serverSnapshot) {
            this._serverSnapshot = {
                schemaVersion: 1,
                branchName: this._branchName,
                metadata: {
                    orgName: this._orgName,
                    docsUrl: this._docsUrl
                },
                pageRegistry: {},
                docsYmlBaseContent: null,
                docsYmlChanges: new Map(),
                version: 0
            };
        }
        return this._serverSnapshot;
    }

    // HELPERS
    // --------------------------------------------------------------------------

    /** Require hydration from storage, prevents hydration errors and data loss from operations before data is loaded */
    private _requireHydratedFromStorage(): void {
        if (!this._storage) {
            throw new Error("NavigationStorage not available in NavigationStore");
        }
        if (!this._hydrated) {
            throw new Error("Cannot perform this operation before NavigationStore hydration completes");
        }
    }

    /** Notifies all subscribers of store changes */
    private _notify(): void {
        this._listeners.forEach((listener) => listener());
    }

    /** Updates storage snapshot and notifies listeners */
    private _setStorageAndNotify(): void {
        this._requireHydratedFromStorage();

        this._version++;
        const snapshot: NavigationSnapshot = {
            schemaVersion: 1,
            branchName: this._branchName,
            metadata: {
                orgName: this._orgName,
                docsUrl: this._docsUrl
            },
            pageRegistry: this._pageRegistry,
            docsYmlBaseContent: this._docsYmlBaseContent,
            docsYmlChanges: this._docsYmlChanges,
            lastCommittedHash: this._lastCommittedHash,
            version: this._version
        };

        // Persist to storage (guaranteed to exist after hydration)
        this._storage?.setStore(this._branchName, this._orgName, this._docsUrl, snapshot);

        this._latestSnapshot = snapshot;
        this._notify();
    }

    /** Creates a new page entry in the registry */
    private _createPageEntry(filename: PageFilename, entry: PageRegistryEntry): void {
        if (this._pageRegistry[filename]) {
            throw new Error(`Page entry already exists for file: ${filename}`);
        }
        this._pageRegistry[filename] = entry;
        this._setStorageAndNotify();
    }

    /** Returns a page entry or throws if not found */
    private _getPageEntry(filename: PageFilename): PageRegistryEntry {
        const entry = this._pageRegistry[filename];
        if (!entry) {
            throw new Error(`Could not find page entry for file: ${filename}`);
        }
        return entry;
    }

    /** Updates an existing page entry in the registry */
    private _updatePageEntry(
        filename: PageFilename,
        update: Partial<PageRegistryEntry> | { pageData?: Partial<ResolvedPageData> }
    ): void {
        const entry = this._getPageEntry(filename);
        const shouldRecompute = update.pageData?.mdx !== entry.pageData.mdx;

        // Force recomputation if HTML is missing to ensure data consistency
        const forceRecompute = !entry.pageData.html || entry.pageData.html.length === 0;
        const needsRecompute = shouldRecompute || forceRecompute;

        const { html, frontmatter } = needsRecompute
            ? mdxToHtml(update.pageData?.mdx ?? entry.pageData.mdx ?? "", {
                  treatAsUnsupported: ["math"]
              })
            : { html: entry.pageData.html, frontmatter: entry.pageData.frontmatter };

        this._pageRegistry[filename] = {
            ...entry,
            ...update,
            pageData: { ...entry.pageData, ...update.pageData, html, frontmatter }
        };
        this._setStorageAndNotify();
    }

    /** Extracts the parent section ID from a found node's parents */
    private _extractParentSectionId(foundNode: SerializableFoundNode): FernNavigation.NodeId | undefined {
        // Find the closest section parent in the parents array
        const sectionParent = foundNode.parents
            .slice()
            .reverse()
            .find((parent) => parent.type === "section");
        return sectionParent?.id;
    }

    /** Extracts the closest parent section title from section path */
    private _extractSectionTitle(sectionPath: SectionAncestorMetadata[]): string | null {
        const section = sectionPath
            .slice()
            .reverse()
            .find((ancestor) => ancestor.type === "section");
        return section?.title || null;
    }

    /** Reconstructs the target section path from a page entry's found node */
    private _reconstructTargetSectionPath(entry: PageRegistryEntry): SectionAncestorMetadata[] {
        const foundNode = entry.pageData.foundNode;
        return foundNode.parents.map((parent) => ({
            id: parent.id,
            type:
                parent.type === "section"
                    ? ("section" as const)
                    : parent.type === "sidebarRoot"
                      ? ("sidebarRoot" as const)
                      : ("sidebarGroup" as const),
            title: "title" in parent ? parent.title : null
        }));
    }

    /** Extracts the tab slug from found node */
    private _extractTabSlug(foundNode: SerializableFoundNode): string | undefined {
        return foundNode.currentTab?.slug;
    }
}
