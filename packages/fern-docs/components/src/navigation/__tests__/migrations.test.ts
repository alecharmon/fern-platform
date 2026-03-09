import type { FernNavigation } from "@fern-api/fdr-sdk";
import { describe, expect, it } from "vitest";

import { runMigrations } from "../migrations";
import type { PreviousNavigationSnapshots } from "../migrations.types";
import type { NavigationSnapshot } from "../types";

describe("migrations", () => {
    describe("V1 to V2", () => {
        it("should preserve rename_section and add_page changes with committed status", () => {
            const v1Data: PreviousNavigationSnapshots["V1"] = {
                schemaVersion: 1,
                branchName: "test-branch",
                metadata: {
                    docsUrl: "https://test.docs.com",
                    orgName: "test-org"
                },
                pageRegistry: {
                    "new-page.mdx": {
                        pageData: {
                            filename: "new-page.mdx",
                            mdx: "# New Page",
                            source: "client",
                            frontmatter: { title: "New Page" },
                            html: "<h1>New Page</h1>",
                            foundNode: {
                                type: "found",
                                node: {
                                    type: "page",
                                    id: "new-page" as FernNavigation.NodeId,
                                    collapsed: undefined,
                                    title: "New Page",
                                    slug: "new-page" as FernNavigation.Slug,
                                    pageId: "new-page" as FernNavigation.PageId,
                                    canonicalSlug: "new-page" as FernNavigation.Slug,
                                    authed: undefined,
                                    availability: undefined,
                                    featureFlags: undefined,
                                    hidden: undefined,
                                    icon: undefined,
                                    noindex: undefined,
                                    orphaned: undefined,
                                    viewers: undefined
                                },
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
                        status: "committed",
                        isMarkedForDeletion: false
                    }
                },
                docsYmlBaseContent: "navigation:\n  - section: Old Section\n    contents: []",
                docsYmlChanges: new Map([
                    [
                        "rename:section-id",
                        {
                            type: "rename_section",
                            sectionId: "section-id" as FernNavigation.NodeId,
                            oldTitle: "Old Section",
                            newTitle: "RENAMED SECTION",
                            createdAt: Date.now(),
                            committed: true
                        }
                    ],
                    [
                        "new-page.mdx",
                        {
                            type: "add_page",
                            sectionTitle: "RENAMED SECTION",
                            pageEntry: { page: "new-page.mdx", path: "pages/new-page.mdx" },
                            createdAt: Date.now(),
                            committed: true
                        }
                    ]
                ]),
                version: 1
            };

            const result = runMigrations("test-branch", v1Data, 1) as NavigationSnapshot;

            // Check schema version is updated
            expect(result.schemaVersion).toBe(2);

            // Check navigationChanges (renamed from docsYmlChanges) are preserved
            expect(result.navigationChanges.size).toBe(2);

            // Check rename_section change is preserved with committed status
            const renameChange = result.navigationChanges.get("rename:section-id");
            expect(renameChange).toBeDefined();
            expect(renameChange?.type).toBe("rename_section");
            if (renameChange?.type === "rename_section") {
                expect(renameChange.sectionId).toBe("section-id");
                expect(renameChange.oldTitle).toBe("Old Section");
                expect(renameChange.newTitle).toBe("RENAMED SECTION");
                expect(renameChange.committed).toBe(true);
                expect(renameChange.docsYmlFilePath).toBe("docs.yml");
            }

            // Check add_page change is preserved with committed status
            const addPageChange = result.navigationChanges.get("new-page.mdx");
            expect(addPageChange).toBeDefined();
            expect(addPageChange?.type).toBe("add_page");
            if (addPageChange?.type === "add_page") {
                expect(addPageChange.sectionTitle).toBe("RENAMED SECTION");
                expect(addPageChange.pageEntry.page).toBe("new-page.mdx");
                expect(addPageChange.committed).toBe(true);
                expect(addPageChange.docsYmlFilePath).toBe("docs.yml");
                expect(addPageChange.insertionMode).toBe("append");
            }

            // Check page registry is preserved
            expect(result.pageRegistry["new-page.mdx"]).toBeDefined();
            expect(result.pageRegistry["new-page.mdx"]?.status).toBe("committed");
        });

        it("should convert docsYmlBaseContent from string to Map", () => {
            const v1Data: PreviousNavigationSnapshots["V1"] = {
                schemaVersion: 1,
                branchName: "test-branch",
                metadata: {
                    docsUrl: "https://test.docs.com",
                    orgName: "test-org"
                },
                pageRegistry: {},
                docsYmlBaseContent: "navigation:\n  - page: test",
                docsYmlChanges: new Map(),
                version: 1
            };

            const result = runMigrations("test-branch", v1Data, 1) as NavigationSnapshot;

            expect(result.docsYmlBaseContent).toBeInstanceOf(Map);
            expect((result.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(
                "navigation:\n  - page: test"
            );
        });

        it("should handle null docsYmlBaseContent", () => {
            const v1Data: PreviousNavigationSnapshots["V1"] = {
                schemaVersion: 1,
                branchName: "test-branch",
                metadata: {
                    docsUrl: "https://test.docs.com",
                    orgName: "test-org"
                },
                pageRegistry: {},
                docsYmlBaseContent: null,
                docsYmlChanges: new Map(),
                version: 1
            };

            const result = runMigrations("test-branch", v1Data, 1) as NavigationSnapshot;

            expect(result.docsYmlBaseContent).toBeNull();
        });

        describe("idempotency", () => {
            it("should not double-wrap docsYmlBaseContent if already a Map", () => {
                const yamlContent = "navigation:\n  - page: test";
                const v1DataWithMap: any = {
                    schemaVersion: 1,
                    branchName: "test-branch",
                    metadata: {
                        docsUrl: "https://test.docs.com",
                        orgName: "test-org"
                    },
                    pageRegistry: {},
                    docsYmlBaseContent: new Map([["docs.yml", yamlContent]]), // Already a Map
                    docsYmlChanges: new Map(),
                    version: 1
                };

                const result = runMigrations("test-branch", v1DataWithMap, 1) as NavigationSnapshot;

                expect(result.docsYmlBaseContent).toBeInstanceOf(Map);
                expect((result.docsYmlBaseContent as Map<string, string>).size).toBe(1);
                expect((result.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(yamlContent);
            });

            it("should not double-wrap docsYmlBaseContent if already serialized as array", () => {
                const yamlContent = "navigation:\n  - page: test";
                const v1DataWithArray: any = {
                    schemaVersion: 1,
                    branchName: "test-branch",
                    metadata: {
                        docsUrl: "https://test.docs.com",
                        orgName: "test-org"
                    },
                    pageRegistry: {},
                    docsYmlBaseContent: [["docs.yml", yamlContent]], // Serialized Map as array
                    docsYmlChanges: new Map(),
                    version: 1
                };

                const result = runMigrations("test-branch", v1DataWithArray, 1) as NavigationSnapshot;

                expect(result.docsYmlBaseContent).toBeInstanceOf(Map);
                expect((result.docsYmlBaseContent as Map<string, string>).size).toBe(1);
                expect((result.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(yamlContent);
            });

            it("should produce identical results when run multiple times", () => {
                const v1Data: PreviousNavigationSnapshots["V1"] = {
                    schemaVersion: 1,
                    branchName: "test-branch",
                    metadata: {
                        docsUrl: "https://test.docs.com",
                        orgName: "test-org"
                    },
                    pageRegistry: {
                        "test.mdx": {
                            pageData: {
                                filename: "test.mdx",
                                mdx: "# Test",
                                source: "client",
                                frontmatter: { title: "Test" },
                                html: "<h1>Test</h1>",
                                foundNode: {
                                    type: "found",
                                    node: {
                                        type: "page",
                                        id: "test" as FernNavigation.NodeId,
                                        collapsed: undefined,
                                        title: "Test",
                                        slug: "test" as FernNavigation.Slug,
                                        pageId: "test" as FernNavigation.PageId,
                                        canonicalSlug: "test" as FernNavigation.Slug,
                                        authed: undefined,
                                        availability: undefined,
                                        featureFlags: undefined,
                                        hidden: undefined,
                                        icon: undefined,
                                        noindex: undefined,
                                        orphaned: undefined,
                                        viewers: undefined
                                    },
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
                            status: "changed",
                            isMarkedForDeletion: false
                        }
                    },
                    docsYmlBaseContent: "navigation:\n  - page: test",
                    docsYmlChanges: new Map([
                        [
                            "test.mdx",
                            {
                                type: "add_page",
                                sectionTitle: "Test Section",
                                pageEntry: { page: "test.mdx", path: "pages/test.mdx" },
                                createdAt: 123456789
                            }
                        ]
                    ]),
                    version: 1
                };

                // Run migration first time
                const result1 = runMigrations("test-branch", v1Data, 1) as NavigationSnapshot;

                // Simulate what happens when V2 data is loaded and passed through migration again
                // We need to rename navigationChanges back to docsYmlChanges for this test
                const v2DataAsV1: any = {
                    ...result1,
                    docsYmlChanges: result1.navigationChanges // Simulate the field being named wrong
                };

                // Run migration second time on the result (simulating double-migration)
                const result2 = runMigrations("test-branch", v2DataAsV1, 1) as NavigationSnapshot;

                // Results should be identical (deep equal)
                expect(result2.schemaVersion).toBe(result1.schemaVersion);
                expect(result2.pageRegistry).toEqual(result1.pageRegistry);
                expect(result2.navigationChanges.size).toBe(result1.navigationChanges.size);

                // Check docsYmlBaseContent is not double-wrapped
                expect(result2.docsYmlBaseContent).toBeInstanceOf(Map);
                expect((result2.docsYmlBaseContent as Map<string, string>).size).toBe(1);
                expect((result2.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(
                    "navigation:\n  - page: test"
                );
            });

            it("should not double-migrate navigationChanges that already have docsYmlFilePath", () => {
                const changeWithFilePath: any = {
                    type: "add_page",
                    sectionTitle: "Test Section",
                    pageEntry: { page: "test.mdx", path: "pages/test.mdx" },
                    createdAt: 123456789,
                    committed: false,
                    docsYmlFilePath: "docs.yml", // Already has docsYmlFilePath (V2 format)
                    insertionMode: "append"
                };

                const v1DataWithV2Change: any = {
                    schemaVersion: 1,
                    branchName: "test-branch",
                    metadata: {
                        docsUrl: "https://test.docs.com",
                        orgName: "test-org"
                    },
                    pageRegistry: {},
                    docsYmlBaseContent: "navigation:\n  - page: test",
                    docsYmlChanges: new Map([["test.mdx", changeWithFilePath]]),
                    version: 1
                };

                const result = runMigrations("test-branch", v1DataWithV2Change, 1) as NavigationSnapshot;

                const change = result.navigationChanges.get("test.mdx");
                expect(change).toBeDefined();
                if (change?.type === "add_page") {
                    expect(change.docsYmlFilePath).toBe("docs.yml");
                    expect(change.insertionMode).toBe("append");
                }
            });

            it("should handle 10 consecutive migrations without data growth", () => {
                const yamlContent = "navigation:\n  - section: Test\n    contents:\n      - page: test.mdx";
                const v1Data: PreviousNavigationSnapshots["V1"] = {
                    schemaVersion: 1,
                    branchName: "test-branch",
                    metadata: {
                        docsUrl: "https://test.docs.com",
                        orgName: "test-org"
                    },
                    pageRegistry: {
                        "test.mdx": {
                            pageData: {
                                filename: "test.mdx",
                                mdx: "# Test Page Content",
                                source: "client",
                                frontmatter: { title: "Test" },
                                html: "<h1>Test Page Content</h1>",
                                foundNode: {
                                    type: "found",
                                    node: {
                                        type: "page",
                                        id: "test" as FernNavigation.NodeId,
                                        collapsed: undefined,
                                        title: "Test",
                                        slug: "test" as FernNavigation.Slug,
                                        pageId: "test" as FernNavigation.PageId,
                                        canonicalSlug: "test" as FernNavigation.Slug,
                                        authed: undefined,
                                        availability: undefined,
                                        featureFlags: undefined,
                                        hidden: undefined,
                                        icon: undefined,
                                        noindex: undefined,
                                        orphaned: undefined,
                                        viewers: undefined
                                    },
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
                            status: "changed",
                            isMarkedForDeletion: false
                        }
                    },
                    docsYmlBaseContent: yamlContent,
                    docsYmlChanges: new Map([
                        [
                            "test.mdx",
                            {
                                type: "add_page",
                                sectionTitle: "Test",
                                pageEntry: { page: "test.mdx", path: "pages/test.mdx" },
                                createdAt: 123456789
                            }
                        ]
                    ]),
                    version: 1
                };

                // Simulate 10 page loads (migration runs)
                let result = runMigrations("test-branch", v1Data, 1) as NavigationSnapshot;
                const firstResultSize = JSON.stringify(result).length;

                for (let i = 0; i < 9; i++) {
                    // Simulate what happens on page reload: data gets serialized/deserialized
                    const serialized = JSON.stringify({
                        ...result,
                        navigationChanges: Array.from(result.navigationChanges.entries()),
                        docsYmlBaseContent:
                            result.docsYmlBaseContent instanceof Map
                                ? Array.from(result.docsYmlBaseContent.entries())
                                : result.docsYmlBaseContent
                    });
                    const deserialized = JSON.parse(serialized);

                    // Simulate migration running again with deserialized data
                    const dataToMigrate: any = {
                        ...deserialized,
                        docsYmlChanges: new Map(deserialized.navigationChanges)
                    };

                    result = runMigrations("test-branch", dataToMigrate, 1) as NavigationSnapshot;
                }

                // After 10 migrations, data size should remain stable
                const finalResultSize = JSON.stringify(result).length;
                expect(finalResultSize).toBe(firstResultSize);

                // Verify structure integrity
                expect(result.docsYmlBaseContent).toBeInstanceOf(Map);
                expect((result.docsYmlBaseContent as Map<string, string>).size).toBe(1);
                expect((result.docsYmlBaseContent as Map<string, string>).get("docs.yml")).toBe(yamlContent);
                expect(result.navigationChanges.size).toBe(1);
                expect(Object.keys(result.pageRegistry).length).toBe(1);
            });

            it("should maintain stable Map structure across serialization cycles", () => {
                const yamlContent = "navigation:\n  - page: test1.mdx\n  - page: test2.mdx";

                // Start with V2 data (already migrated)
                const v2Data: any = {
                    schemaVersion: 2,
                    branchName: "test-branch",
                    metadata: {
                        docsUrl: "https://test.docs.com",
                        orgName: "test-org"
                    },
                    pageRegistry: {},
                    docsYmlBaseContent: new Map([["docs.yml", yamlContent]]),
                    navigationChanges: new Map(),
                    slugToDocsYmlFilePath: new Map([
                        ["test1", "docs.yml"],
                        ["test2", "docs.yml"]
                    ]),
                    version: 1
                };

                // Simulate 5 serialization/deserialization/migration cycles
                let currentData = v2Data;
                const originalYamlContent = yamlContent;

                for (let i = 0; i < 5; i++) {
                    // Serialize (what happens when saving to storage)
                    const serialized = JSON.stringify({
                        ...currentData,
                        docsYmlBaseContent: Array.from(currentData.docsYmlBaseContent.entries()),
                        navigationChanges: Array.from(currentData.navigationChanges.entries()),
                        slugToDocsYmlFilePath: Array.from(currentData.slugToDocsYmlFilePath.entries())
                    });

                    // Deserialize (what happens when loading from storage)
                    const deserialized = JSON.parse(serialized);

                    // Simulate migration check (schemaVersion 2, but V1 migration gets called with deserialized data)
                    const dataToMigrate: any = {
                        ...deserialized,
                        docsYmlChanges: new Map(deserialized.navigationChanges)
                    };

                    currentData = runMigrations("test-branch", dataToMigrate, 1);
                }

                // After 5 cycles, verify data integrity
                expect(currentData.docsYmlBaseContent).toBeInstanceOf(Map);
                const baseContentMap = currentData.docsYmlBaseContent as Map<string, string>;
                expect(baseContentMap.size).toBe(1);
                expect(baseContentMap.get("docs.yml")).toBe(originalYamlContent);

                // Verify no nested Map structures
                const value = baseContentMap.get("docs.yml");
                expect(typeof value).toBe("string");
                expect(value).not.toBeInstanceOf(Map);
                expect(Array.isArray(value)).toBe(false);
            });
        });
    });
});
