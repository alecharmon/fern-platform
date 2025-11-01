import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { type ChangedNodes, type Frontmatter, htmlToMdx, mdxToHtml } from "@fern-docs/mdx";
import {
    computeStateHash,
    type FilenameToContent,
    formatCommitFiles,
    type GitCommitFile,
    hasChangesToCommit
} from "./commitUtils";
import { createNavigationBufferedIndexedDBStorage, type NavigationStorage } from "./NavigationStorage";
import {
    findPageByPageId,
    findSectionById,
    findSectionTitleById,
    injectPageIntoSection,
    updateSectionTitle
} from "./navigationTreeUtils";
import { extractDocsYmlFilePathFromFoundNode, resolvePageData } from "./pageUtils";
import type {
    ClientPageDataWriteDependencies,
    DeletionToastCallback,
    DocsYmlBaseContent,
    DocsYmlFilePath,
    NavigationChange,
    NavigationSlug,
    NavigationSnapshot,
    NestedEditorUpdateEvent,
    PageData,
    PageDataDependencies,
    PageFilename,
    PageRegistry,
    PageRegistryEntry,
    PageSaveEvent,
    ResolvedPageData,
    SerializableFoundNode
} from "./types";
import { buildSlugToDocsYmlFilePath, createEmptyNavigationSnapshot, NAVIGATION_SNAPSHOT_SCHEMA_VERSION } from "./types";
import { buildDocsYmlContentFromChanges, isYmlFilePath } from "./ymlUtils";

export class NavigationStore {
    private _branchName: string;
    private _orgName: string;
    private _docsUrl: string;
    private _latestSnapshot: NavigationSnapshot;
    private _serverSnapshot: NavigationSnapshot | null = null;

    private _pageRegistry: PageRegistry;
    private _docsYmlBaseContent: DocsYmlBaseContent;
    private _navigationChanges: Map<PageFilename, NavigationChange>;
    private _slugToDocsYmlFilePath?: Map<NavigationSlug, DocsYmlFilePath>;
    private _rootNode?: FernNavigation.RootNode;
    private _lastCommittedHash?: string;
    private _version: number;

    private _storage?: NavigationStorage;
    private _hydrated = false;
    private _hydrationPromise?: Promise<void>;
    private _deletionToastCallback?: DeletionToastCallback;

    private _listeners = new Set<() => void>();
    private _pageSaveEventListeners = new Set<(event: PageSaveEvent) => void>();
    private _nestedEditorUpdateListeners = new Set<(event: NestedEditorUpdateEvent) => void>();

    constructor(branchName: string, orgName: string, docsUrl: string) {
        this._branchName = branchName;
        this._orgName = orgName;
        this._docsUrl = docsUrl;
        this._latestSnapshot = createEmptyNavigationSnapshot(branchName, orgName, docsUrl);

        this._pageRegistry = this._latestSnapshot.pageRegistry;
        this._docsYmlBaseContent = this._latestSnapshot.docsYmlBaseContent;
        this._navigationChanges = this._latestSnapshot.navigationChanges;
        this._rootNode = this._latestSnapshot.rootNode;
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

    /** Returns the root navigation node */
    get rootNode(): FernNavigation.RootNode | undefined {
        return this._rootNode;
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

        this._navigationChanges.forEach((change, filename) => {
            if (change.type === "remove_page" && !change.committed && !deletedFiles.includes(filename)) {
                deletedFiles.push(filename);
            }
        });

        // Only count uncommitted changes
        const uncommittedChangesCount = Array.from(this._navigationChanges.values()).filter(
            (change) => !change.committed
        ).length;

        if (uncommittedChangesCount > 0) {
            try {
                const docsYmlChangedContent = buildDocsYmlContentFromChanges(this._latestSnapshot);

                // buildDocsYmlContentFromChanges returns only CHANGED files
                for (const [filePath, content] of docsYmlChangedContent.entries()) {
                    changedFiles[filePath] = content;
                }
            } catch (error) {
                console.error("Failed to generate docs.yml:", error);
                // Don't throw - changes are tracked but docs.yml generation failed
                // This may happen when base content is not yet loaded
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
    async hydrate(options?: {
        storage?: NavigationStorage;
        latestDocsYmlAndReferences?: Map<string, string> | null;
    }): Promise<void> {
        if (this._hydrated) {
            // If already hydrated, update docsYmlBaseContent and slugToDocsYmlFilePath if provided
            if (options?.latestDocsYmlAndReferences !== undefined) {
                this._updateDocsYmlBaseContent(options.latestDocsYmlAndReferences);
            }
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
        latestDocsYmlAndReferences?: Map<string, string> | null;
    }): Promise<void> {
        this._storage = options?.storage || createNavigationBufferedIndexedDBStorage();

        // Initialize storage and wait for it to complete
        await this._storage.init();

        // Only access storage after init is complete
        const storedSnapshot = this._storage.getOrSetStore(this._branchName, this._orgName, this._docsUrl);

        this._latestSnapshot = storedSnapshot;
        this._pageRegistry = storedSnapshot.pageRegistry;

        // Merge strategy: prefer stored entries (they may have uncommitted changes),
        // use fresh data to fill missing entries (e.g., after migration or when new referenced files are added)
        // NOTE: because old version of NavigationSnapshot did not support multiple files, we need to make a
        // best effort to merge the content. However, because the latestDocsYmlAndReferences may be newer than the
        // stored content (fetched from the default branch), there may be inconsistencies.
        if (storedSnapshot.docsYmlBaseContent && options?.latestDocsYmlAndReferences) {
            // Start with stored content (source of truth for committed/uncommitted state)
            const merged = new Map(storedSnapshot.docsYmlBaseContent);
            // Add missing entries from fresh data
            for (const [key, value] of options.latestDocsYmlAndReferences) {
                if (!merged.has(key)) {
                    merged.set(key, value);
                }
            }
            this._docsYmlBaseContent = merged;
        } else {
            // Fallback: use whichever is available
            this._docsYmlBaseContent = options?.latestDocsYmlAndReferences ?? storedSnapshot.docsYmlBaseContent ?? null;
        }

        // Always rebuild the slug map from the resolved content
        this._slugToDocsYmlFilePath = buildSlugToDocsYmlFilePath(this._docsYmlBaseContent);

        this._navigationChanges = storedSnapshot.navigationChanges;
        this._rootNode = storedSnapshot.rootNode;
        this._lastCommittedHash = storedSnapshot.lastCommittedHash;
        this._version = storedSnapshot.version;

        // Validate that navigation changes reference files that exist
        if (this._docsYmlBaseContent && this._navigationChanges.size > 0) {
            const missingFiles = new Set<string>();
            for (const change of this._navigationChanges.values()) {
                if (!this._docsYmlBaseContent.has(change.docsYmlFilePath)) {
                    missingFiles.add(change.docsYmlFilePath);
                }
            }

            if (missingFiles.size > 0) {
                console.error("[NavigationStore] Hydration error: Missing referenced files:", Array.from(missingFiles));
                console.error("[NavigationStore] Available files:", Array.from(this._docsYmlBaseContent.keys()));
            }
        }

        this._hydrated = true;

        this._setStorageAndNotify();
    }

    /** Set the deletion toast callback */
    setDeletionToastCallback(callback: DeletionToastCallback): void {
        this._deletionToastCallback = callback;
    }

    /** Sets the root navigation node */
    setRootNode(rootNode: FernNavigation.RootNode): void {
        this._rootNode = rootNode;
        this._setStorageAndNotify();
    }

    /** Renames a section and tracks the change in docs.yml */
    renameSection(sectionId: FernNavigation.NodeId, newTitle: string): void {
        if (!this._rootNode) {
            console.warn("Cannot rename section: rootNode not available");
            return;
        }

        // Find section in the tree
        const searchResult = findSectionById(this._rootNode, sectionId);

        if (!searchResult) {
            console.warn(`Cannot rename section: node ${sectionId} not found or not a section`);
            return;
        }

        const { section: sectionNode, tabSlug, product, version } = searchResult;
        const oldTitle = sectionNode.title;

        // Update the section title in rootNode
        const updatedRootNode = updateSectionTitle(this._rootNode, sectionId, newTitle);
        this._rootNode = updatedRootNode;

        // Create a new Map to trigger React re-renders
        this._navigationChanges = new Map(this._navigationChanges);

        // Determine which file this section belongs to using the section's context
        // Build a minimal SerializableFoundNode to use with extractDocsYmlFilePathFromFoundNode
        const contextForExtraction: SerializableFoundNode = {
            type: "found",
            node: sectionNode as any, // Use section as placeholder - we only need the context
            parents: [],
            sidebar: undefined,
            tabs: [],
            currentTab: tabSlug ? ({ slug: tabSlug } as any) : undefined,
            currentVersion: version,
            currentProduct: product,
            isCurrentVersionDefault: false,
            isCurrentProductDefault: false
        };

        const docsYmlFilePath = extractDocsYmlFilePathFromFoundNode(contextForExtraction, this._slugToDocsYmlFilePath);

        // Update all existing add_page changes that reference the old section title
        // This ensures new pages added to a renamed section use the correct section title in docs.yml
        this._navigationChanges.forEach((change, key) => {
            if (change.type === "add_page" && change.sectionTitle === oldTitle) {
                // Check if the tab matches (or both are undefined for root navigation)
                if (change.tabSlug === tabSlug) {
                    this._navigationChanges.set(key, {
                        ...change,
                        sectionTitle: newTitle
                    });
                }
            }
        });

        // Track the rename change in docs.yml
        const changeKey = `section-rename-${sectionId}`;

        // Check if there's already a rename for this section
        // If so, preserve the original oldTitle to collapse multiple renames into one
        // e.g., "SECTION 0" -> "SECTION 1" -> "SECTION 2" becomes "SECTION 0" -> "SECTION 2"
        const existingRename = this._navigationChanges.get(changeKey);
        const actualOldTitle =
            existingRename?.type === "rename_section"
                ? existingRename.oldTitle // Keep the original old title
                : oldTitle; // First rename, use current old title

        this._navigationChanges.set(changeKey, {
            type: "rename_section",
            sectionId,
            oldTitle: actualOldTitle,
            newTitle,
            tabSlug,
            docsYmlFilePath,
            createdAt: Date.now()
        });

        this._setStorageAndNotify();
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

        // The targetSectionPath is the path TO the target section (including the section itself at the end)
        // We want to inject into that target section, so we use the last element's ID
        const targetSectionId =
            deps.targetSectionPath.length > 0
                ? deps.targetSectionPath[deps.targetSectionPath.length - 1]?.id
                : undefined;

        // Create the new page node
        const newPageNode: FernNavigation.PageNode = {
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
        };

        this._createPageEntry(filename, {
            pageData: {
                source: "client",
                filename: filename,
                mdx: deps.initialMdx,
                html: html,
                frontmatter: frontmatter,
                foundNode: {
                    ...deps.baseFoundNode,
                    node: newPageNode
                }
            },
            status: "changed",
            isMarkedForDeletion: false,
            lastModified: Date.now(),
            parentSectionId: targetSectionId,
            initialMdx: deps.initialMdx
        });

        // Extract the docs file path from navigation context
        const docsYmlFilePath = extractDocsYmlFilePathFromFoundNode(deps.baseFoundNode, this._slugToDocsYmlFilePath);

        // Calculate insertion index from RootNode order before injecting
        const insertionIndex =
            this._rootNode && targetSectionId ? this._calculateInsertionIndex(targetSectionId) : undefined;

        // Create a new Map to trigger React re-renders (useSyncExternalStore uses shallow comparison)
        this._navigationChanges = new Map(this._navigationChanges);
        this._navigationChanges.set(filename, {
            type: "add_page",
            sectionTitle: this._extractSectionTitleFromRootNode(targetSectionId),
            tabSlug: this._extractTabSlug(deps.baseFoundNode),
            pageEntry: { page: title, path: filename },
            insertionMode: "atIndex",
            insertionIndex,
            docsYmlFilePath,
            createdAt: Date.now()
        });

        // Inject the new page into the RootNode at the correct location
        if (this._rootNode && targetSectionId) {
            this._rootNode = injectPageIntoSection(
                this._rootNode,
                newPageNode,
                targetSectionId,
                "atIndex",
                insertionIndex
            );
        }

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
        // Create a new Map to trigger React re-renders
        this._navigationChanges = new Map(this._navigationChanges);
        this._navigationChanges.delete(filename);

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

            // Extract the docs file path from navigation context
            const docsYmlFilePath = extractDocsYmlFilePathFromFoundNode(
                entry.pageData.foundNode,
                this._slugToDocsYmlFilePath
            );

            // Convert filename to be relative to the yml file's directory
            const relativePath = this._makePathRelativeToYmlFile(filename, docsYmlFilePath);

            // Create a new Map to trigger React re-renders
            this._navigationChanges = new Map(this._navigationChanges);
            this._navigationChanges.set(filename, {
                type: "remove_page",
                pageEntry: {
                    page: entry.pageData.foundNode.node.title,
                    path: relativePath
                },
                docsYmlFilePath,
                createdAt: Date.now()
            });

            this._setStorageAndNotify();

            // Show deletion toast with undo functionality
            if (this._deletionToastCallback) {
                this._deletionToastCallback(entry.pageData.foundNode.node.title, () =>
                    this.unmarkPageForDeletion(filename)
                );
            }
        } else if (pageTitle) {
            // For server pages not in registry, find the page in rootNode to determine correct yml file
            let docsYmlFilePath = "docs.yml"; // Default fallback

            if (this._rootNode) {
                const pageId = FernNavigation.PageId(filename);
                const pageSearchResult = findPageByPageId(this._rootNode, pageId);

                if (pageSearchResult) {
                    // Build a minimal SerializableFoundNode to extract the docs yml file path
                    const contextForExtraction: SerializableFoundNode = {
                        type: "found",
                        node: pageSearchResult.page,
                        parents: [],
                        sidebar: undefined,
                        tabs: [],
                        currentTab: pageSearchResult.tabSlug ? ({ slug: pageSearchResult.tabSlug } as any) : undefined,
                        currentVersion: pageSearchResult.version,
                        currentProduct: pageSearchResult.product,
                        isCurrentVersionDefault: false,
                        isCurrentProductDefault: false
                    };

                    docsYmlFilePath = extractDocsYmlFilePathFromFoundNode(
                        contextForExtraction,
                        this._slugToDocsYmlFilePath
                    );
                }
            }

            // Convert filename to be relative to the yml file's directory
            const relativePath = this._makePathRelativeToYmlFile(filename, docsYmlFilePath);

            // Create a new Map to trigger React re-renders
            this._navigationChanges = new Map(this._navigationChanges);
            this._navigationChanges.set(filename, {
                type: "remove_page",
                pageEntry: { page: pageTitle, path: relativePath },
                docsYmlFilePath,
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
                const docsYmlFilePath = extractDocsYmlFilePathFromFoundNode(
                    entry.pageData.foundNode,
                    this._slugToDocsYmlFilePath
                );

                // Calculate insertion index from RootNode order
                // Exclude this page from the count since it's still in the rootNode (deletion doesn't remove it)
                const pageId = (entry.pageData.foundNode.node as FernNavigation.PageNode).pageId;
                const insertionIndex =
                    this._rootNode && entry.parentSectionId
                        ? this._calculateInsertionIndex(entry.parentSectionId, pageId)
                        : undefined;

                // Create a new Map to trigger React re-renders
                this._navigationChanges = new Map(this._navigationChanges);
                this._navigationChanges.set(filename, {
                    type: "add_page",
                    sectionTitle: this._extractSectionTitleFromRootNode(entry.parentSectionId),
                    tabSlug: this._extractTabSlug(entry.pageData.foundNode),
                    pageEntry: { page: title, path: filename },
                    insertionMode: "atIndex",
                    insertionIndex,
                    docsYmlFilePath,
                    createdAt: Date.now()
                });
            } else {
                // For server pages, just remove the deletion change
                // Create a new Map to trigger React re-renders
                this._navigationChanges = new Map(this._navigationChanges);
                this._navigationChanges.delete(filename);
            }

            this._setStorageAndNotify();
        } else if (this._navigationChanges.has(filename)) {
            // Handle server pages that are not in the registry but have deletion changes
            // This occurs when markPageForDeletion was called with only pageTitle (server pages not in registry)
            // Create a new Map to trigger React re-renders
            this._navigationChanges = new Map(this._navigationChanges);
            this._navigationChanges.delete(filename);
            this._setStorageAndNotify();
        }
    }

    /** Handles successful commit by cleaning up changed and deleted pages */
    handleCommitSuccess(): void {
        const newRegistry: PageRegistry = {};

        Object.entries(this._pageRegistry).forEach(([filename, entry]) => {
            if (!entry) return;

            if (entry.isMarkedForDeletion) {
                // Skip deleted pages - don't add them to newRegistry
                return;
            } else if (entry.status === "changed") {
                newRegistry[filename] = { ...entry, status: "committed" };
            } else {
                newRegistry[filename] = entry;
            }
        });

        this._pageRegistry = newRegistry;

        // IMPORTANT: Capture yml file changes BEFORE marking them as committed
        // Otherwise, the files getter will skip yml generation because uncommittedChangesCount === 0
        const committedYmlFiles: Record<string, string> = {};
        if (this._docsYmlBaseContent && this._navigationChanges.size > 0) {
            try {
                const docsYmlChangedContent = buildDocsYmlContentFromChanges(this._latestSnapshot);

                // Collect yml files that have uncommitted changes
                const filesWithUncommittedChanges = new Set<string>();
                for (const change of this._navigationChanges.values()) {
                    if (!change.committed) {
                        filesWithUncommittedChanges.add(change.docsYmlFilePath);
                    }
                }

                // Capture the yml content for files that will be committed
                for (const filePath of filesWithUncommittedChanges) {
                    const content = docsYmlChangedContent.get(filePath);
                    if (content && isYmlFilePath(filePath)) {
                        committedYmlFiles[filePath] = content;
                    }
                }
            } catch (error) {
                console.error("[handleCommitSuccess] Failed to build yml files before commit:", error);
            }
        }

        // Mark changes as committed
        const deletionMarkers = new Map<string, NavigationChange>();
        this._navigationChanges.forEach((change, filename) => {
            if (change.type === "remove_page") {
                deletionMarkers.set(filename, { ...change, committed: true });
            }
        });
        // Create a new Map with only deletion markers to trigger React re-renders
        this._navigationChanges = deletionMarkers;

        // Update docsYmlBaseContent with the committed yml changes
        if (this._docsYmlBaseContent && Object.keys(committedYmlFiles).length > 0) {
            Object.entries(committedYmlFiles).forEach(([filePath, content]) => {
                if (this._docsYmlBaseContent) {
                    this._docsYmlBaseContent.set(filePath, content);
                }
            });
            // Rebuild the slug-to-file-path map with the updated content
            this._slugToDocsYmlFilePath = buildSlugToDocsYmlFilePath(this._docsYmlBaseContent);
        }

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

    /** Emits a nested editor update event to all listeners */
    emitNestedEditorUpdate(event: NestedEditorUpdateEvent): void {
        this._nestedEditorUpdateListeners.forEach((listener) => listener(event));
    }

    /** Subscribes to nested editor update events */
    subscribeNestedEditorUpdate(listener: (event: NestedEditorUpdateEvent) => void): () => void {
        this._nestedEditorUpdateListeners.add(listener);
        return () => this._nestedEditorUpdateListeners.delete(listener);
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
                schemaVersion: NAVIGATION_SNAPSHOT_SCHEMA_VERSION,
                branchName: this._branchName,
                metadata: {
                    orgName: this._orgName,
                    docsUrl: this._docsUrl
                },
                pageRegistry: {},
                docsYmlBaseContent: null,
                navigationChanges: new Map(),
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

    /** Updates docsYmlBaseContent and rebuilds slugToDocsYmlFilePath */
    private _updateDocsYmlBaseContent(content: string | Map<string, string> | null): void {
        // Convert string to Map if needed
        let normalizedContent = content;
        if (typeof normalizedContent === "string") {
            normalizedContent = new Map([["docs.yml", normalizedContent]]);
        }

        // Only update if the content actually changed
        const hasChanged =
            this._docsYmlBaseContent !== normalizedContent &&
            JSON.stringify(
                this._docsYmlBaseContent instanceof Map ? Array.from(this._docsYmlBaseContent.entries()) : null
            ) !== JSON.stringify(normalizedContent instanceof Map ? Array.from(normalizedContent.entries()) : null);

        if (!hasChanged) {
            return;
        }

        this._docsYmlBaseContent = normalizedContent;
        this._slugToDocsYmlFilePath = buildSlugToDocsYmlFilePath(normalizedContent);

        this._setStorageAndNotify();
    }

    /** Updates storage snapshot and notifies listeners */
    private _setStorageAndNotify(): void {
        this._requireHydratedFromStorage();

        this._version++;
        const snapshot: NavigationSnapshot = {
            schemaVersion: NAVIGATION_SNAPSHOT_SCHEMA_VERSION,
            branchName: this._branchName,
            metadata: {
                orgName: this._orgName,
                docsUrl: this._docsUrl
            },
            pageRegistry: this._pageRegistry,
            docsYmlBaseContent: this._docsYmlBaseContent,
            navigationChanges: this._navigationChanges,
            rootNode: this._rootNode,
            lastCommittedHash: this._lastCommittedHash,
            version: this._version,
            slugToDocsYmlFilePath: this._slugToDocsYmlFilePath
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

    /** Extracts the section title from the current rootNode by section ID (always returns current/renamed title) */
    private _extractSectionTitleFromRootNode(sectionId?: FernNavigation.NodeId): string | null {
        if (!sectionId || !this._rootNode) {
            return null;
        }

        return findSectionTitleById(this._rootNode, sectionId);
    }

    /**
     * Converts an absolute file path to be relative to the yml file's directory
     * @todo unify logic with github-loader.ts, we do something similar there
     * */
    private _makePathRelativeToYmlFile(absolutePath: string, ymlFilePath: string): string {
        // Get the directory of the yml file
        // e.g., "products/docs/docs.yml" -> "products/docs/"
        const ymlDir = ymlFilePath.substring(0, ymlFilePath.lastIndexOf("/") + 1);

        // If the absolute path starts with the yml directory, make it relative
        if (absolutePath.startsWith(ymlDir)) {
            const relativePath = absolutePath.substring(ymlDir.length);
            // Add "./" prefix to match yml convention
            return `./${relativePath}`;
        }

        // If paths don't share a common directory, return the path as-is with "./" prefix
        // This handles edge cases where the page might be outside the expected structure
        return `./${absolutePath}`;
    }

    /** Extracts the tab slug from found node */
    private _extractTabSlug(foundNode: SerializableFoundNode): string | undefined {
        return foundNode.currentTab?.slug;
    }

    /** Calculates the insertion index for a new page within a section (appends after all children) */
    private _calculateInsertionIndex(
        sectionId: FernNavigation.NodeId,
        excludePageId?: FernNavigation.PageId
    ): number | undefined {
        if (!this._rootNode) {
            return undefined;
        }

        const section = findSectionById(this._rootNode, sectionId);
        if (!section) {
            return undefined;
        }

        // Count all children, but exclude the specified page if it's already in the tree
        // (This happens when unmarking a client page for deletion - it's still in rootNode)
        if (excludePageId) {
            return section.section.children.filter(
                (child) => !(child.type === "page" && (child as FernNavigation.PageNode).pageId === excludePageId)
            ).length;
        }

        return section.section.children.length;
    }
}
