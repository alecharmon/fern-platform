import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { describe, expect, it } from "vitest";
import {
    findSectionById,
    findSectionTitleById,
    injectPageIntoSection,
    updateSectionTitle
} from "../navigationTreeUtils";
import { getAllPageContainersFromSidebarRootNode } from "../pageUtils";

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

        it("should inject page into sidebarGroup", () => {
            // Create a root node with a sidebarGroup
            const rootNode: FernNavigation.RootNode = {
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
                                type: "sidebarGroup",
                                id: FernNavigation.NodeId("sidebar-group-1"),
                                children: []
                            }
                        ]
                    }
                }
            };

            const newPage: FernNavigation.PageNode = {
                type: "page",
                id: FernNavigation.NodeId("new-page"),
                title: "Root Level Page",
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

            const updatedNode = injectPageIntoSection(rootNode, newPage, FernNavigation.NodeId("sidebar-group-1"));

            // Check that page was added to sidebarGroup
            const unversioned = updatedNode.child as FernNavigation.UnversionedNode;
            const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;
            const sidebarGroup = sidebarRoot.children[0] as FernNavigation.SidebarGroupNode;

            expect(sidebarGroup.children).toHaveLength(1);
            expect(sidebarGroup.children[0]?.type).toBe("page");
            expect((sidebarGroup.children[0] as FernNavigation.PageNode).title).toBe("Root Level Page");
        });

        it("should inject page into sidebarRoot when no sidebarGroups exist", () => {
            // Create a root node with no sidebarGroups
            const rootNode: FernNavigation.RootNode = {
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
                        children: []
                    }
                }
            };

            const newPage: FernNavigation.PageNode = {
                type: "page",
                id: FernNavigation.NodeId("new-page"),
                title: "First Page",
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

            const updatedNode = injectPageIntoSection(rootNode, newPage, FernNavigation.NodeId("sidebar-root"));

            // Check that a sidebarGroup was created and page was added to it
            const unversioned = updatedNode.child as FernNavigation.UnversionedNode;
            const sidebarRoot = unversioned.child as FernNavigation.SidebarRootNode;

            expect(sidebarRoot.children).toHaveLength(1);
            expect(sidebarRoot.children[0]?.type).toBe("sidebarGroup");

            const sidebarGroup = sidebarRoot.children[0] as FernNavigation.SidebarGroupNode;
            expect(sidebarGroup.children).toHaveLength(1);
            expect(sidebarGroup.children[0]?.type).toBe("page");
            expect((sidebarGroup.children[0] as FernNavigation.PageNode).title).toBe("First Page");
        });
    });

    describe("getAllPageContainersFromSidebarRootNode", () => {
        it("should return exactly one root-level container when 0 sidebarGroups exist", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: []
            };

            const containers = getAllPageContainersFromSidebarRootNode(sidebarRoot);
            const rootLevelContainers = containers.filter((c) => "isRootLevel" in c && c.isRootLevel);

            expect(rootLevelContainers).toHaveLength(1);
            expect(rootLevelContainers[0]?.type).toBe("sidebarRoot");
            expect(rootLevelContainers[0]?.id).toBe("sidebar-root");
        });

        it("should return exactly one root-level container when 1 sidebarGroup exists", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sidebar-group-1"),
                        children: []
                    }
                ]
            };

            const containers = getAllPageContainersFromSidebarRootNode(sidebarRoot);
            const rootLevelContainers = containers.filter((c) => "isRootLevel" in c && c.isRootLevel);

            expect(rootLevelContainers).toHaveLength(1);
            expect(rootLevelContainers[0]?.type).toBe("sidebarGroup");
            expect(rootLevelContainers[0]?.id).toBe("sidebar-group-1");
        });

        it("should return exactly one root-level container when 2+ sidebarGroups exist", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sidebar-group-1"),
                        children: []
                    },
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sidebar-group-2"),
                        children: []
                    },
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sidebar-group-3"),
                        children: []
                    }
                ]
            };

            const containers = getAllPageContainersFromSidebarRootNode(sidebarRoot);
            const rootLevelContainers = containers.filter((c) => "isRootLevel" in c && c.isRootLevel);

            // Should return exactly one entry, using the last sidebarGroup
            expect(rootLevelContainers).toHaveLength(1);
            expect(rootLevelContainers[0]?.type).toBe("sidebarGroup");
            expect(rootLevelContainers[0]?.id).toBe("sidebar-group-3");
        });

        it("should include sections in addition to root-level container", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sidebar-group-1"),
                        children: []
                    },
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
                        children: []
                    }
                ]
            };

            const containers = getAllPageContainersFromSidebarRootNode(sidebarRoot);
            const sections = containers.filter((c) => c.type === "section");
            const rootLevelContainers = containers.filter((c) => "isRootLevel" in c && c.isRootLevel);

            expect(sections).toHaveLength(1);
            expect(rootLevelContainers).toHaveLength(1);
            expect(containers).toHaveLength(2);
        });

        it("should include children property in root-level container for duplicate validation", () => {
            const existingPage: FernNavigation.PageNode = {
                type: "page",
                id: FernNavigation.NodeId("existing-page"),
                title: "Existing Page",
                slug: FernNavigation.Slug("existing-page"),
                pageId: FernNavigation.PageId("existing-page"),
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

            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sidebar-group-1"),
                        children: [existingPage]
                    }
                ]
            };

            const containers = getAllPageContainersFromSidebarRootNode(sidebarRoot);
            const rootLevelContainer = containers.find((c) => "isRootLevel" in c && c.isRootLevel);

            // Verify children property exists
            expect(rootLevelContainer).toBeDefined();
            expect(rootLevelContainer).toHaveProperty("children");
            expect(Array.isArray(rootLevelContainer?.children)).toBe(true);

            // Verify we can check for duplicate slugs using the children property
            const hasDuplicate =
                "children" in rootLevelContainer! &&
                rootLevelContainer.children
                    ?.filter((child) => child.type === "page")
                    .some((page) => (page as FernNavigation.PageNode).slug === "existing-page");

            expect(hasDuplicate).toBe(true);
        });

        it("should include children from sidebarRoot when no sidebarGroups exist", () => {
            const section: FernNavigation.SectionNode = {
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
                children: []
            };

            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [section]
            };

            const containers = getAllPageContainersFromSidebarRootNode(sidebarRoot);
            const rootLevelContainer = containers.find((c) => "isRootLevel" in c && c.isRootLevel);

            // When no sidebarGroups exist, should use sidebarRoot type
            expect(rootLevelContainer?.type).toBe("sidebarRoot");
            expect(rootLevelContainer?.children).toBeDefined();
            expect(rootLevelContainer?.children).toHaveLength(1);
            expect(rootLevelContainer?.children[0]).toBe(section);
        });
    });
});
