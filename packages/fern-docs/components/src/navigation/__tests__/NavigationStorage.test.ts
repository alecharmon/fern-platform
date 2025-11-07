import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import { _createNavigationMemoryStorage, type NavigationStorage } from "../NavigationStorage";
import { createEmptyNavigationSnapshot, type NavigationSnapshot } from "../types";

const MOCK_ORG_NAME = "test-org";
const MOCK_DOCS_URL = "https://test.com";

const createTestNode = (): FernNavigation.PageNode => ({
    id: "test-page" as FernNavigation.NodeId,
    type: "page" as const,
    title: "Test Page",
    slug: "test-page" as FernNavigation.Slug,
    pageId: "test-page" as FernNavigation.PageId,
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

const createTestData = (): NavigationSnapshot =>
    createEmptyNavigationSnapshot("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL);

describe("NavigationStorage", () => {
    let storage: NavigationStorage;

    beforeEach(async () => {
        storage = _createNavigationMemoryStorage();
        await storage.init();
    });

    it("should store, retrieve, and handle Map serialization", () => {
        const testData = createTestData();
        testData.navigationChanges.set("test.mdx", {
            type: "add_page",
            pageEntry: { page: "Test", path: "test.mdx" },
            docsYmlFilePath: "docs.yml",
            insertionMode: "append",
            createdAt: Date.now()
        });

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const retrieved = storage.getStore("test-branch");

        expect(retrieved?.docsYmlBaseContent).toBe(null);
        expect(retrieved?.navigationChanges).toBeInstanceOf(Map);
        expect(retrieved?.navigationChanges.has("test.mdx")).toBe(true);
    });

    it("should return null for non-existent branch", () => {
        const result = storage.getStore("non-existent-branch");

        expect(result).toBeNull();
    });

    it("should update existing store data", () => {
        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, createTestData());

        const updatedContent = new Map([["docs.yml", "updated"]]);
        storage.updateStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, {
            docsYmlBaseContent: updatedContent,
            version: 1
        });

        const result = storage.getStore("test-branch");
        expect(result?.docsYmlBaseContent).toBeInstanceOf(Map);
        expect((result?.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe("updated");
        expect(result?.version).toBe(1);
    });

    it("should handle page registry data", () => {
        const testData = {
            ...createTestData(),
            pageRegistry: {
                "test.mdx": {
                    pageData: {
                        source: "client" as const,
                        filename: "test.mdx",
                        mdx: "# Test",
                        html: "<h1>Test</h1>",
                        frontmatter: { title: "Test" },
                        foundNode: {
                            type: "found" as const,
                            node: createTestNode(),
                            parents: [],
                            sidebar: undefined,
                            tabs: [],
                            currentTab: undefined,
                            currentVersion: undefined,
                            currentProduct: undefined,
                            currentVariant: undefined,
                            isCurrentVersionDefault: true,
                            isCurrentProductDefault: true
                        }
                    },
                    status: "changed" as const,
                    isMarkedForDeletion: false,
                    lastModified: Date.now(),
                    index: "a0"
                }
            }
        };

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(Object.keys(result?.pageRegistry || {})).toContain("test.mdx");
        expect(result?.pageRegistry["test.mdx"]?.pageData.filename).toBe("test.mdx");
    });

    it("should serialize and deserialize docsYmlBaseContent as Map", () => {
        // Create test data with docsYmlBaseContent as a Map
        const testData = createTestData();
        const docsYmlMap = new Map<string, string>();
        docsYmlMap.set("docs.yml", "navigation:\n  - page: Overview");
        docsYmlMap.set("versions/v2_2.yml", "navigation:\n  - page: V2.2 Content");

        testData.docsYmlBaseContent = docsYmlMap as any;

        // Store the data
        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);

        // Retrieve and verify it's still a Map with the same content
        const result = storage.getStore("test-branch");

        expect(result?.docsYmlBaseContent).toBeInstanceOf(Map);
        expect((result?.docsYmlBaseContent as Map<string, string>).size).toBe(2);
        expect((result?.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(
            "navigation:\n  - page: Overview"
        );
        expect((result?.docsYmlBaseContent as Map<string, string>).get("versions/v2_2.yml")).toBe(
            "navigation:\n  - page: V2.2 Content"
        );
    });

    it("should store docsYmlBaseContent as Map", () => {
        const testData = createTestData();
        testData.docsYmlBaseContent = new Map([["docs.yml", "navigation:\n  - page: Overview"]]);

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(result?.docsYmlBaseContent).toBeInstanceOf(Map);
        expect((result?.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(
            "navigation:\n  - page: Overview"
        );
    });

    it("should handle empty Map for docsYmlBaseContent", () => {
        const testData = createTestData();
        testData.docsYmlBaseContent = new Map<string, string>();

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(result?.docsYmlBaseContent).toBeInstanceOf(Map);
        expect((result?.docsYmlBaseContent as Map<string, string>).size).toBe(0);
    });

    it("should serialize and deserialize slugToDocsYmlFilePath", () => {
        const testData = createTestData();
        const slugMap = new Map<string, string>();
        slugMap.set("v2", "versions/v2.yml");
        slugMap.set("platform", "platform/docs.yml");
        testData.slugToDocsYmlFilePath = slugMap;

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(result?.slugToDocsYmlFilePath).toBeInstanceOf(Map);
        expect(result?.slugToDocsYmlFilePath?.size).toBe(2);
        expect(result?.slugToDocsYmlFilePath?.get("v2")).toBe("versions/v2.yml");
        expect(result?.slugToDocsYmlFilePath?.get("platform")).toBe("platform/docs.yml");
    });

    it("should handle empty Map for slugToDocsYmlFilePath", () => {
        const testData = createTestData();
        testData.slugToDocsYmlFilePath = new Map<string, string>();

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(result?.slugToDocsYmlFilePath).toBeInstanceOf(Map);
        expect(result?.slugToDocsYmlFilePath?.size).toBe(0);
    });

    it("should handle undefined slugToDocsYmlFilePath", () => {
        const testData = createTestData();
        testData.slugToDocsYmlFilePath = undefined;

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(result?.slugToDocsYmlFilePath).toBeUndefined();
    });

    it("should handle empty navigationChanges Map", () => {
        const testData = createTestData();
        testData.navigationChanges = new Map();

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        expect(result?.navigationChanges).toBeInstanceOf(Map);
        expect(result?.navigationChanges.size).toBe(0);
    });

    it("should handle all three Map types simultaneously", () => {
        const testData = createTestData();

        // Set up all Maps with data
        testData.navigationChanges.set("page1.mdx", {
            type: "add_page",
            pageEntry: { page: "Page 1", path: "page1.mdx" },
            docsYmlFilePath: "docs.yml",
            insertionMode: "append",
            createdAt: Date.now()
        });

        const docsYmlMap = new Map<string, string>();
        docsYmlMap.set("docs.yml", "navigation:\n  - page: Main");
        docsYmlMap.set("versions/v2.yml", "navigation:\n  - page: V2");
        testData.docsYmlBaseContent = docsYmlMap;

        const slugMap = new Map<string, string>();
        slugMap.set("v2", "versions/v2.yml");
        slugMap.set("v1", "versions/v1.yml");
        testData.slugToDocsYmlFilePath = slugMap;

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const result = storage.getStore("test-branch");

        // Verify all Maps are correctly deserialized
        expect(result?.navigationChanges).toBeInstanceOf(Map);
        expect(result?.navigationChanges.size).toBe(1);
        expect(result?.navigationChanges.has("page1.mdx")).toBe(true);

        expect(result?.docsYmlBaseContent).toBeInstanceOf(Map);
        expect((result?.docsYmlBaseContent as Map<string, string>).size).toBe(2);
        expect((result?.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe("navigation:\n  - page: Main");

        expect(result?.slugToDocsYmlFilePath).toBeInstanceOf(Map);
        expect(result?.slugToDocsYmlFilePath?.size).toBe(2);
        expect(result?.slugToDocsYmlFilePath?.get("v2")).toBe("versions/v2.yml");
    });

    it("should persist migrated V1 data to storage after migration", () => {
        // Create V1 data structure with navigation changes
        // Note: V1 stores Maps as arrays when serialized
        const v1Data = {
            schemaVersion: 1,
            branchName: "test-branch",
            metadata: {
                orgName: MOCK_ORG_NAME,
                docsUrl: MOCK_DOCS_URL
            },
            pageRegistry: {},
            docsYmlBaseContent: "navigation:\n  - page: test",
            // V1 docsYmlChanges serialized as array of [key, value] tuples
            docsYmlChanges: [
                [
                    "test.mdx",
                    {
                        type: "add_page",
                        pageEntry: { page: "test.mdx", path: "pages/test.mdx" },
                        createdAt: Date.now(),
                        committed: true
                    }
                ]
            ],
            version: 1
        };

        // Manually store V1 data as JSON (simulating old storage format)
        const serialized = JSON.stringify(v1Data);
        // @ts-expect-error - accessing private field for testing
        storage._storage.set("test-branch", serialized);

        // First access should trigger migration
        const firstResult = storage.getStore("test-branch");
        expect(firstResult?.schemaVersion).toBe(2);
        expect(firstResult?.navigationChanges).toBeInstanceOf(Map);
        expect(firstResult?.navigationChanges.size).toBe(1);

        // Second access should load from migrated storage (not re-migrate)
        const secondResult = storage.getStore("test-branch");
        expect(secondResult?.schemaVersion).toBe(2);
        expect(secondResult?.navigationChanges).toBeInstanceOf(Map);
        expect(secondResult?.navigationChanges.size).toBe(1);

        // Verify the change was properly migrated with all V2 fields
        const change = secondResult?.navigationChanges.get("test.mdx");
        expect(change?.type).toBe("add_page");
        if (change?.type === "add_page") {
            expect(change.docsYmlFilePath).toBe("docs.yml");
            expect(change.insertionMode).toBe("append");
            expect(change.committed).toBe(true);
        }
    });
});
