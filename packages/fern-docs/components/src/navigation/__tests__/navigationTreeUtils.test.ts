import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { describe, expect, it } from "vitest";
import {
    findSectionById,
    findSectionTitleById,
    injectPageIntoSection,
    updateSectionTitle
} from "../navigationTreeUtils";

const createTestRootNode = (): FernNavigation.RootNode => ({
    type: "root",
    id: FernNavigation.NodeId("root"),
    version: "v2",
    title: "Root",
    slug: FernNavigation.Slug("root"),
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
        type: "unversioned",
        id: FernNavigation.NodeId("unversioned"),
        landingPage: undefined,
        child: {
            type: "sidebarRoot",
            id: FernNavigation.NodeId("sidebar-root"),
            children: [
                {
                    type: "section",
                    id: FernNavigation.NodeId("section-1"),
                    title: "Section 1",
                    slug: FernNavigation.Slug("section-1"),
                    collapsed: false,
                    overviewPageId: undefined,
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    noindex: undefined,
                    availability: undefined,
                    pointsTo: undefined,
                    children: [
                        {
                            type: "page",
                            id: FernNavigation.NodeId("page-1"),
                            title: "Page 1",
                            slug: FernNavigation.Slug("page-1"),
                            pageId: FernNavigation.PageId("page-1"),
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            noindex: undefined,
                            availability: undefined
                        }
                    ]
                },
                {
                    type: "section",
                    id: FernNavigation.NodeId("section-2"),
                    title: "Section 2",
                    slug: FernNavigation.Slug("section-2"),
                    collapsed: false,
                    overviewPageId: undefined,
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    noindex: undefined,
                    availability: undefined,
                    pointsTo: undefined,
                    children: []
                }
            ]
        }
    }
});

describe("navigationTreeUtils", () => {
    describe("findSectionById", () => {
        it("should find section by ID", () => {
            const rootNode = createTestRootNode();
            const result = findSectionById(rootNode, FernNavigation.NodeId("section-1"));

            expect(result).toBeDefined();
            expect(result?.section.id).toBe("section-1");
            expect(result?.section.title).toBe("Section 1");
        });

        it("should return undefined when section not found", () => {
            const rootNode = createTestRootNode();
            const result = findSectionById(rootNode, FernNavigation.NodeId("nonexistent"));

            expect(result).toBeUndefined();
        });

        it("should find multiple sections", () => {
            const rootNode = createTestRootNode();
            const result1 = findSectionById(rootNode, FernNavigation.NodeId("section-1"));
            const result2 = findSectionById(rootNode, FernNavigation.NodeId("section-2"));

            expect(result1?.section.title).toBe("Section 1");
            expect(result2?.section.title).toBe("Section 2");
        });
    });

    describe("findSectionTitleById", () => {
        it("should find section title by ID", () => {
            const rootNode = createTestRootNode();
            const title = findSectionTitleById(rootNode, FernNavigation.NodeId("section-1"));

            expect(title).toBe("Section 1");
        });

        it("should return null when section not found", () => {
            const rootNode = createTestRootNode();
            const title = findSectionTitleById(rootNode, FernNavigation.NodeId("nonexistent"));

            expect(title).toBeNull();
        });
    });

    describe("updateSectionTitle", () => {
        it("should update section title immutably", () => {
            const rootNode = createTestRootNode();
            const updatedNode = updateSectionTitle(rootNode, FernNavigation.NodeId("section-1"), "New Title");

            // Original should be unchanged
            const originalSection = findSectionById(rootNode, FernNavigation.NodeId("section-1"));
            expect(originalSection?.section.title).toBe("Section 1");

            // Updated should have new title
            const updatedSection = findSectionById(updatedNode, FernNavigation.NodeId("section-1"));
            expect(updatedSection?.section.title).toBe("New Title");
        });

        it("should preserve other sections when updating one", () => {
            const rootNode = createTestRootNode();
            const updatedNode = updateSectionTitle(rootNode, FernNavigation.NodeId("section-1"), "New Title");

            const section2 = findSectionById(updatedNode, FernNavigation.NodeId("section-2"));
            expect(section2?.section.title).toBe("Section 2");
        });

        it("should handle non-existent section gracefully", () => {
            const rootNode = createTestRootNode();
            const updatedNode = updateSectionTitle(rootNode, FernNavigation.NodeId("nonexistent"), "New Title");

            // Tree should remain unchanged
            const section1 = findSectionById(updatedNode, FernNavigation.NodeId("section-1"));
            expect(section1?.section.title).toBe("Section 1");
        });
    });

    describe("injectPageIntoSection", () => {
        it("should inject page into section", () => {
            const rootNode = createTestRootNode();
            const newPage: FernNavigation.PageNode = {
                type: "page",
                id: FernNavigation.NodeId("new-page"),
                title: "New Page",
                slug: FernNavigation.Slug("new-page"),
                pageId: FernNavigation.PageId("new-page"),
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                noindex: undefined,
                availability: undefined
            };

            const updatedNode = injectPageIntoSection(rootNode, newPage, FernNavigation.NodeId("section-2"));

            // Check that page was added to section-2
            const unversioned = updatedNode.child as FernNavigation.UnversionedNode;
            const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
            const section2 = sidebarRoot.children[1] as FernNavigation.SectionNode;

            expect(section2.children).toHaveLength(1);
            expect(section2.children[0]?.type).toBe("page");
            expect((section2.children[0] as FernNavigation.PageNode).title).toBe("New Page");
        });

        it("should not modify original tree when injecting page", () => {
            const rootNode = createTestRootNode();
            const newPage: FernNavigation.PageNode = {
                type: "page",
                id: FernNavigation.NodeId("new-page"),
                title: "New Page",
                slug: FernNavigation.Slug("new-page"),
                pageId: FernNavigation.PageId("new-page"),
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                noindex: undefined,
                availability: undefined
            };

            injectPageIntoSection(rootNode, newPage, FernNavigation.NodeId("section-2"));

            // Original tree should be unchanged
            const unversioned = rootNode.child as FernNavigation.UnversionedNode;
            const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
            const section2 = sidebarRoot.children[1] as FernNavigation.SectionNode;

            expect(section2.children).toHaveLength(0);
        });

        it("should preserve existing pages when injecting new page", () => {
            const rootNode = createTestRootNode();
            const newPage: FernNavigation.PageNode = {
                type: "page",
                id: FernNavigation.NodeId("new-page"),
                title: "New Page",
                slug: FernNavigation.Slug("new-page"),
                pageId: FernNavigation.PageId("new-page"),
                canonicalSlug: undefined,
                icon: undefined,
                hidden: undefined,
                authed: undefined,
                viewers: undefined,
                orphaned: undefined,
                featureFlags: undefined,
                noindex: undefined,
                availability: undefined
            };

            const updatedNode = injectPageIntoSection(rootNode, newPage, FernNavigation.NodeId("section-1"));

            // Check that existing page is preserved
            const unversioned = updatedNode.child as FernNavigation.UnversionedNode;
            const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
            const section1 = sidebarRoot.children[0] as FernNavigation.SectionNode;

            expect(section1.children).toHaveLength(2);
            expect((section1.children[0] as FernNavigation.PageNode).title).toBe("Page 1");
            expect((section1.children[1] as FernNavigation.PageNode).title).toBe("New Page");
        });
    });
});
