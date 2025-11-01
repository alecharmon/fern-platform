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
    });
});
