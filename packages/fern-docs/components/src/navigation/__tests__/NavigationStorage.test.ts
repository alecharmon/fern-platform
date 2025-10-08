import type { FernNavigation } from "@fern-api/fdr-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import { _createNavigationMemoryStorage, type NavigationStorage } from "../NavigationStorage";

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

const createTestData = () => ({
    schemaVersion: 1,
    branchName: "test-branch",
    pageRegistry: {},
    docsYmlBaseContent: "",
    docsYmlChanges: new Map<string, any>(),
    lastCommittedHash: undefined,
    metadata: {
        orgName: MOCK_ORG_NAME,
        docsUrl: MOCK_DOCS_URL
    },
    version: 0
});

describe("NavigationStorage", () => {
    let storage: NavigationStorage;

    beforeEach(async () => {
        storage = _createNavigationMemoryStorage();
        await storage.init();
    });

    it("should store, retrieve, and handle Map serialization", () => {
        const testData = createTestData();
        testData.docsYmlChanges.set("test.mdx", {
            type: "add_page",
            pageEntry: { page: "Test", path: "test.mdx" },
            createdAt: Date.now()
        });

        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, testData);
        const retrieved = storage.getStore("test-branch");

        expect(retrieved?.docsYmlBaseContent).toBe("");
        expect(retrieved?.docsYmlChanges).toBeInstanceOf(Map);
        expect(retrieved?.docsYmlChanges.has("test.mdx")).toBe(true);
    });

    it("should return null for non-existent branch", () => {
        const result = storage.getStore("non-existent-branch");

        expect(result).toBeNull();
    });

    it("should update existing store data", () => {
        storage.setStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, createTestData());

        storage.updateStore("test-branch", MOCK_ORG_NAME, MOCK_DOCS_URL, {
            docsYmlBaseContent: "updated",
            version: 1
        });

        const result = storage.getStore("test-branch");
        expect(result?.docsYmlBaseContent).toBe("updated");
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
});
