import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { _createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";
import type { RemoteSnapshotSync } from "../types";

const createTestNode = (id = "test-id", title = "Test Page"): FernNavigation.PageNode => ({
    id: id as FernNavigation.NodeId,
    collapsed: undefined,
    type: "page" as const,
    title,
    slug: title.toLowerCase().replace(" ", "-") as FernNavigation.Slug,
    pageId: id as FernNavigation.PageId,
    availability: undefined,
    canonicalSlug: undefined,
    icon: undefined,
    hidden: undefined,
    authed: undefined,
    viewers: undefined,
    orphaned: undefined,
    featureFlags: undefined,
    noindex: undefined
});

const createFoundNode = (node: FernNavigation.PageNode) => ({
    type: "found" as const,
    node,
    parents: [],
    sidebar: undefined,
    tabs: [],
    currentTab: undefined,
    currentVersion: undefined,
    currentProduct: undefined,
    currentVariant: undefined,
    isCurrentVersionDefault: true,
    isCurrentProductDefault: true
});

function createMockRemoteSync(): RemoteSnapshotSync & {
    saveSnapshot: ReturnType<typeof vi.fn>;
    patchSnapshot: ReturnType<typeof vi.fn>;
} {
    return {
        loadSnapshot: vi.fn().mockResolvedValue(null),
        saveSnapshot: vi.fn().mockResolvedValue(undefined),
        patchSnapshot: vi.fn().mockResolvedValue(undefined),
        deleteSnapshot: vi.fn().mockResolvedValue(undefined),
        listSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
        updateMetadata: vi.fn().mockResolvedValue(undefined)
    };
}

describe("NavigationStore granular patch", () => {
    let store: NavigationStore;
    let mockRemoteSync: ReturnType<typeof createMockRemoteSync>;

    beforeEach(async () => {
        mockRemoteSync = createMockRemoteSync();
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            remoteSync: mockRemoteSync
        });
    });

    describe("dirty page tracking", () => {
        it("should track newly created pages as dirty", () => {
            const filename = "new-page.mdx";
            const testNode = createTestNode("new-page", "New Page");

            store.registerPage({
                source: "client",
                filename,
                mdx: "# New Page",
                html: "<h1>New Page</h1>",
                frontmatter: { title: "New Page" },
                foundNode: createFoundNode(testNode)
            });

            // After registering, the page should be in the registry
            expect(store.registeredPages[filename]).toBeDefined();
        });

        it("should track updated pages as dirty", () => {
            const filename = "existing-page.mdx";
            const testNode = createTestNode("existing-page", "Existing Page");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Original",
                html: "<h1>Original</h1>",
                frontmatter: { title: "Original" },
                foundNode: createFoundNode(testNode)
            });

            store.updatePage(filename, { mdx: "# Updated Content" });

            const entry = store.registeredPages[filename];
            expect(entry?.pageData.mdx).toBe("# Updated Content");
            expect(entry?.status).toBe("changed");
        });

        it("should track deleted pages", () => {
            const filename = "to-delete.mdx";
            const testNode = createTestNode("to-delete", "To Delete");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Delete Me",
                html: "<h1>Delete Me</h1>",
                frontmatter: { title: "Delete Me" },
                foundNode: createFoundNode(testNode)
            });

            store.markPageForDeletion(filename);

            expect(store.registeredPages[filename]?.isMarkedForDeletion).toBe(true);
        });

        it("should track deletions in handleCommitSuccess", () => {
            const filename = "committed-delete.mdx";
            const testNode = createTestNode("committed-delete", "Committed Delete");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Committed Delete",
                html: "<h1>Committed Delete</h1>",
                frontmatter: { title: "Committed Delete" },
                foundNode: createFoundNode(testNode)
            });

            store.markPageForDeletion(filename);
            store.handleCommitSuccess();

            // After commit, the deleted page should be removed from registry
            expect(store.registeredPages[filename]).toBeUndefined();
        });
    });

    describe("snapshot delta computation", () => {
        it("should produce no patch when nothing has changed", () => {
            // Just hydrated, no changes made — snapshot should match _lastSavedSnapshot
            const snapshot = store.getSnapshot();

            // Access private method via cast for testing
            const patch = (store as any)._buildSnapshotPatch(snapshot);

            // No changes means patch should be null (empty) or have no changes
            expect(patch).toBeNull();
        });

        it("should include only dirty page entries in patch", () => {
            const filename1 = "page1.mdx";
            const filename2 = "page2.mdx";
            const testNode1 = createTestNode("page1", "Page 1");
            const testNode2 = createTestNode("page2", "Page 2");

            // Register two pages
            store.registerPage({
                source: "server",
                filename: filename1,
                mdx: "# Page 1",
                html: "<h1>Page 1</h1>",
                frontmatter: { title: "Page 1" },
                foundNode: createFoundNode(testNode1)
            });

            store.registerPage({
                source: "server",
                filename: filename2,
                mdx: "# Page 2",
                html: "<h1>Page 2</h1>",
                frontmatter: { title: "Page 2" },
                foundNode: createFoundNode(testNode2)
            });

            // Simulate a successful save to establish baseline
            (store as any)._lastSavedSnapshot = store.getSnapshot();
            (store as any)._dirtyPageKeys.clear();

            // Now update only page1
            store.updatePage(filename1, { mdx: "# Page 1 Updated" });

            const snapshot = store.getSnapshot();
            const patch = (store as any)._buildSnapshotPatch(snapshot);

            expect(patch).not.toBeNull();
            // Patch should contain page1 but NOT page2
            expect(patch.pageRegistry).toBeDefined();
            expect(patch.pageRegistry[filename1]).toBeDefined();
            expect(patch.pageRegistry[filename2]).toBeUndefined();
        });

        it("should include deleted page filenames in patch", () => {
            const filename = "delete-me.mdx";
            const testNode = createTestNode("delete-me", "Delete Me");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Delete Me",
                html: "<h1>Delete Me</h1>",
                frontmatter: { title: "Delete Me" },
                foundNode: createFoundNode(testNode)
            });

            // Establish baseline
            (store as any)._lastSavedSnapshot = store.getSnapshot();
            (store as any)._dirtyPageKeys.clear();

            // Mark for deletion and commit
            store.markPageForDeletion(filename);
            store.handleCommitSuccess();

            const snapshot = store.getSnapshot();
            const patch = (store as any)._buildSnapshotPatch(snapshot);

            expect(patch).not.toBeNull();
            expect(patch.deletedPageFilenames).toBeDefined();
            expect(patch.deletedPageFilenames).toContain(filename);
        });

        it("should detect rootNode changes", () => {
            const rootNode: FernNavigation.RootNode = {
                type: "root",
                id: "root" as FernNavigation.NodeId,
                collapsed: undefined,
                version: "v2",
                title: "Root",
                slug: "root" as FernNavigation.Slug,
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                pointsTo: undefined,
                roles: undefined,
                child: {
                    type: "versioned",
                    id: "versioned" as FernNavigation.NodeId,
                    collapsed: undefined,
                    children: []
                }
            };

            // Establish baseline without rootNode
            (store as any)._lastSavedSnapshot = store.getSnapshot();
            (store as any)._dirtyPageKeys.clear();

            // Now set rootNode
            store.setRootNode(rootNode);

            const snapshot = store.getSnapshot();
            const patch = (store as any)._buildSnapshotPatch(snapshot);

            expect(patch).not.toBeNull();
            expect(patch.rootNode).toEqual(rootNode);
        });

        it("should detect version changes via page registration", () => {
            // Establish baseline at current version
            const baselineSnapshot = store.getSnapshot();
            const baselineVersion = baselineSnapshot.version;
            (store as any)._lastSavedSnapshot = baselineSnapshot;
            (store as any)._dirtyPageKeys.clear();

            // Register a page — this triggers _setStorageAndNotify which increments version
            const testNode = createTestNode("ver-page", "Version Page");
            store.registerPage({
                source: "server",
                filename: "version-test.mdx",
                mdx: "# Version Test",
                html: "<h1>Version Test</h1>",
                frontmatter: { title: "Version Test" },
                foundNode: createFoundNode(testNode)
            });

            const snapshot = store.getSnapshot();
            expect(snapshot.version).toBeGreaterThan(baselineVersion);

            const patch = (store as any)._buildSnapshotPatch(snapshot);

            expect(patch).not.toBeNull();
            expect(patch.version).toBe(snapshot.version);
        });

        it("should return null for first save (no baseline)", () => {
            // Clear the _lastSavedSnapshot that hydrate sets
            (store as any)._lastSavedSnapshot = undefined;

            const snapshot = store.getSnapshot();
            const patch = (store as any)._buildSnapshotPatch(snapshot);

            expect(patch).toBeNull();
        });

        it("should not include unchanged fields in patch besides version", () => {
            const filename = "page.mdx";
            const testNode = createTestNode("page", "Page");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Page",
                html: "<h1>Page</h1>",
                frontmatter: { title: "Page" },
                foundNode: createFoundNode(testNode)
            });

            // Establish baseline
            (store as any)._lastSavedSnapshot = store.getSnapshot();
            (store as any)._dirtyPageKeys.clear();

            // Only update page content (not rootNode, metadata, etc.)
            store.updatePage(filename, { mdx: "# Page Updated" });

            const snapshot = store.getSnapshot();
            const patch = (store as any)._buildSnapshotPatch(snapshot);

            expect(patch).not.toBeNull();
            // Should have pageRegistry but NOT rootNode, metadata, lastCommittedHash
            expect(patch.pageRegistry).toBeDefined();
            expect(patch.rootNode).toBeUndefined();
            expect(patch.metadata).toBeUndefined();
            expect(patch.lastCommittedHash).toBeUndefined();
            // version changes on every _setStorageAndNotify call, so it will be included
            expect(patch.version).toBeDefined();
        });
    });

    describe("remote save behavior", () => {
        it("should call patchSnapshot when there are dirty pages", async () => {
            const filename = "page.mdx";
            const testNode = createTestNode("page", "Page");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Page",
                html: "<h1>Page</h1>",
                frontmatter: { title: "Page" },
                foundNode: createFoundNode(testNode)
            });

            // Establish baseline
            (store as any)._lastSavedSnapshot = store.getSnapshot();
            (store as any)._dirtyPageKeys.clear();

            // Update a page, which triggers _debouncedRemoteSave internally
            store.updatePage(filename, { mdx: "# Updated" });

            // Manually trigger the remote save (bypassing debounce)
            (store as any)._pendingRemoteSnapshot = store.getSnapshot();
            (store as any)._attemptRemoteSave();

            // Wait for the async patchSnapshot call
            await vi.waitFor(() => {
                expect(mockRemoteSync.patchSnapshot).toHaveBeenCalled();
            });

            const callArgs = mockRemoteSync.patchSnapshot.mock.calls[0]?.[0];
            expect(callArgs?.patch).toBeDefined();
            expect(callArgs?.patch.pageRegistry).toBeDefined();
        });

        it("should call saveSnapshot (full save) when no baseline exists", async () => {
            // Clear baseline to simulate first save
            (store as any)._lastSavedSnapshot = undefined;

            const filename = "page.mdx";
            const testNode = createTestNode("page", "Page");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Page",
                html: "<h1>Page</h1>",
                frontmatter: { title: "Page" },
                foundNode: createFoundNode(testNode)
            });

            // Manually trigger the remote save
            (store as any)._pendingRemoteSnapshot = store.getSnapshot();
            (store as any)._attemptRemoteSave();

            // Should fall through to full save since _buildSnapshotPatch returns null
            await vi.waitFor(() => {
                expect(mockRemoteSync.saveSnapshot).toHaveBeenCalled();
            });
        });

        it("should fall back to full save if patchSnapshot fails", async () => {
            mockRemoteSync.patchSnapshot.mockRejectedValueOnce(new Error("Patch failed"));

            const filename = "page.mdx";
            const testNode = createTestNode("page", "Page");

            store.registerPage({
                source: "server",
                filename,
                mdx: "# Page",
                html: "<h1>Page</h1>",
                frontmatter: { title: "Page" },
                foundNode: createFoundNode(testNode)
            });

            // Establish baseline
            (store as any)._lastSavedSnapshot = store.getSnapshot();
            (store as any)._dirtyPageKeys.clear();

            // Update to generate a patch
            store.updatePage(filename, { mdx: "# Updated for fallback" });

            // Trigger save
            (store as any)._pendingRemoteSnapshot = store.getSnapshot();
            (store as any)._attemptRemoteSave();

            // Wait for fallback to full save
            await vi.waitFor(() => {
                expect(mockRemoteSync.saveSnapshot).toHaveBeenCalled();
            });
        });
    });
});
