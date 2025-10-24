import { beforeEach, describe, expect, it } from "vitest";
import { _createNavigationMemoryStorage } from "../NavigationStorage";
import { NavigationStore } from "../NavigationStore";

describe("NavigationStore - canDirectlyEditDocsYmlNavigation", () => {
    let store: NavigationStore;

    beforeEach(async () => {
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({ storage: _createNavigationMemoryStorage() });
    });

    it("should allow navigation editing for simple docs.yml", async () => {
        const simpleDocsYml = `
navigation:
  - section: Getting Started
    contents:
      - page: Introduction
        path: ./intro.mdx
`;
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            initialDocsYmlContent: simpleDocsYml
        });

        expect(store.canDirectlyEditDocsYmlNavigation).toBe(true);
    });

    it("should disallow navigation editing for multi-product docs", async () => {
        const multiProductDocsYml = `
products:
  - id: sdks
    docs: path/to/sdks-docs.yml
  - id: docs
    docs: path/to/docs-docs.yml
`;
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            initialDocsYmlContent: multiProductDocsYml
        });

        expect(store.canDirectlyEditDocsYmlNavigation).toBe(false);
    });

    it("should disallow navigation editing for multi-version docs", async () => {
        const multiVersionDocsYml = `
versions:
  - version: v1
    navigation:
      - page: V1 Home
        path: ./v1/home.mdx
  - version: v2
    navigation:
      - page: V2 Home
        path: ./v2/home.mdx
`;
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            initialDocsYmlContent: multiVersionDocsYml
        });

        expect(store.canDirectlyEditDocsYmlNavigation).toBe(false);
    });

    it("should allow editing when no base content exists", () => {
        expect(store.canDirectlyEditDocsYmlNavigation).toBe(true);
    });

    it("should throw error when renaming section on multi-product docs", async () => {
        const multiProductDocsYml = `
products:
  - id: sdks
    docs: path/to/sdks-docs.yml
`;
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            initialDocsYmlContent: multiProductDocsYml
        });

        expect(() => store.renameSection("section-id" as any, "New Title")).toThrow(
            /not yet supported for multi-product or multi-version/
        );
    });

    it("should throw error when creating client page on multi-product docs", async () => {
        const multiProductDocsYml = `
products:
  - id: sdks
    docs: path/to/sdks-docs.yml
`;
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            initialDocsYmlContent: multiProductDocsYml
        });

        expect(() =>
            store.createClientPage("test.mdx", {
                source: "client",
                filename: "test.mdx",
                initialMdx: "# Test",
                baseFoundNode: {
                    type: "found",
                    node: {} as any,
                    parents: [],
                    sidebar: undefined,
                    tabs: [],
                    currentTab: undefined,
                    currentVersion: undefined,
                    currentProduct: undefined,
                    isCurrentVersionDefault: true,
                    isCurrentProductDefault: true
                },
                targetSectionPath: []
            })
        ).toThrow(/not yet supported for multi-product or multi-version/);
    });

    it("should throw error when marking page for deletion on multi-version docs", async () => {
        const multiVersionDocsYml = `
versions:
  - version: v1
    navigation: []
`;
        store = new NavigationStore("test-branch", "test-org", "https://test.com");
        await store.hydrate({
            storage: _createNavigationMemoryStorage(),
            initialDocsYmlContent: multiVersionDocsYml
        });

        expect(() => store.markPageForDeletion("test.mdx", "Test Page")).toThrow(
            /not yet supported for multi-product or multi-version/
        );
    });
});
