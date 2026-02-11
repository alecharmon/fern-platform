import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { describe, expect, it } from "vitest";
import {
    computeSidebarRootFlatIndex,
    findNodeById,
    findParentNodeId,
    findSectionById,
    findSectionTitleById,
    getChildrenOfNode,
    getSectionAncestorTitles,
    insertNodeIntoParent,
    isDescendantOf,
    moveNodeInTree,
    removeNodeById,
    updateSectionTitle
} from "../navigationTreeUtils";
import { getAllPageContainersFromSidebarRootNode } from "../pageUtils";

// Helper to create a page node with minimal boilerplate
function mkPage(id: string, title?: string): FernNavigation.PageNode {
    return {
        type: "page",
        id: FernNavigation.NodeId(id),
        title: title ?? id,
        slug: FernNavigation.Slug(id),
        pageId: FernNavigation.PageId(id),
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
}

// Helper to create a section node with minimal boilerplate
function mkSection(
    id: string,
    title: string,
    children: FernNavigation.NavigationChild[] = []
): FernNavigation.SectionNode {
    return {
        type: "section",
        id: FernNavigation.NodeId(id),
        title,
        slug: FernNavigation.Slug(id),
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
        children
    };
}

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

    describe("insertNodeIntoParent", () => {
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

            const updatedNode = insertNodeIntoParent(
                rootNode,
                newPage,
                FernNavigation.NodeId("section-2"),
                0,
                "append"
            );

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

            insertNodeIntoParent(rootNode, newPage, FernNavigation.NodeId("section-2"), 0, "append");

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

            const updatedNode = insertNodeIntoParent(
                rootNode,
                newPage,
                FernNavigation.NodeId("section-1"),
                0,
                "append"
            );

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

            const updatedNode = insertNodeIntoParent(
                rootNode,
                newPage,
                FernNavigation.NodeId("sidebar-group-1"),
                0,
                "append"
            );

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

            const updatedNode = insertNodeIntoParent(
                rootNode,
                newPage,
                FernNavigation.NodeId("sidebar-root"),
                0,
                "append"
            );

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

    // -----------------------------------------------------------------------
    // Richer fixture for DnD-related tests
    // -----------------------------------------------------------------------
    // Structure:
    //   root > unversioned > sidebarRoot > [
    //     sidebarGroup > [page-a, page-b]
    //     section-outer "Outer" > [
    //       page-c,
    //       section-inner "Inner" > [page-d]
    //     ]
    //     section-sibling "Sibling" > [page-e]
    //   ]
    const createNestedTestRootNode = (): FernNavigation.RootNode => ({
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
                        id: FernNavigation.NodeId("sidebar-group"),
                        children: [mkPage("page-a", "Page A"), mkPage("page-b", "Page B")]
                    },
                    mkSection("section-outer", "Outer", [
                        mkPage("page-c", "Page C"),
                        mkSection("section-inner", "Inner", [mkPage("page-d", "Page D")])
                    ]),
                    mkSection("section-sibling", "Sibling", [mkPage("page-e", "Page E")])
                ]
            }
        }
    });

    describe("findNodeById", () => {
        it("should find root node", () => {
            const root = createNestedTestRootNode();
            expect(findNodeById(root, FernNavigation.NodeId("root"))?.id).toBe("root");
        });

        it("should find deeply nested page", () => {
            const root = createNestedTestRootNode();
            const node = findNodeById(root, FernNavigation.NodeId("page-d"));
            expect(node).toBeDefined();
            expect(node?.type).toBe("page");
            expect((node as FernNavigation.PageNode).title).toBe("Page D");
        });

        it("should return undefined for missing ID", () => {
            const root = createNestedTestRootNode();
            expect(findNodeById(root, FernNavigation.NodeId("nonexistent"))).toBeUndefined();
        });
    });

    describe("findParentNodeId", () => {
        it("should find parent of a page in a section", () => {
            const root = createNestedTestRootNode();
            expect(findParentNodeId(root, FernNavigation.NodeId("page-c"))).toBe("section-outer");
        });

        it("should find parent of a page in a sidebarGroup", () => {
            const root = createNestedTestRootNode();
            expect(findParentNodeId(root, FernNavigation.NodeId("page-a"))).toBe("sidebar-group");
        });

        it("should find parent of a nested section", () => {
            const root = createNestedTestRootNode();
            expect(findParentNodeId(root, FernNavigation.NodeId("section-inner"))).toBe("section-outer");
        });

        it("should return undefined for root node", () => {
            const root = createNestedTestRootNode();
            expect(findParentNodeId(root, FernNavigation.NodeId("root"))).toBeUndefined();
        });

        it("should return undefined for missing ID", () => {
            const root = createNestedTestRootNode();
            expect(findParentNodeId(root, FernNavigation.NodeId("nonexistent"))).toBeUndefined();
        });
    });

    describe("isDescendantOf", () => {
        it("should detect direct child as descendant", () => {
            const root = createNestedTestRootNode();
            expect(isDescendantOf(root, FernNavigation.NodeId("section-outer"), FernNavigation.NodeId("page-c"))).toBe(
                true
            );
        });

        it("should detect deeply nested descendant", () => {
            const root = createNestedTestRootNode();
            expect(isDescendantOf(root, FernNavigation.NodeId("section-outer"), FernNavigation.NodeId("page-d"))).toBe(
                true
            );
        });

        it("should return false for non-descendant", () => {
            const root = createNestedTestRootNode();
            expect(isDescendantOf(root, FernNavigation.NodeId("section-outer"), FernNavigation.NodeId("page-e"))).toBe(
                false
            );
        });

        it("should return false when ancestor and descendant are the same node", () => {
            const root = createNestedTestRootNode();
            expect(
                isDescendantOf(root, FernNavigation.NodeId("section-outer"), FernNavigation.NodeId("section-outer"))
            ).toBe(false);
        });
    });

    describe("getSectionAncestorTitles", () => {
        it("should return empty array for root-level section", () => {
            const root = createNestedTestRootNode();
            const titles = getSectionAncestorTitles(root, FernNavigation.NodeId("section-outer"));
            expect(titles).toEqual([]);
        });

        it("should return ancestor titles for nested section", () => {
            const root = createNestedTestRootNode();
            const titles = getSectionAncestorTitles(root, FernNavigation.NodeId("section-inner"));
            expect(titles).toEqual(["Outer"]);
        });

        it("should return empty array for node not found", () => {
            const root = createNestedTestRootNode();
            const titles = getSectionAncestorTitles(root, FernNavigation.NodeId("nonexistent"));
            expect(titles).toEqual([]);
        });
    });

    describe("getChildrenOfNode", () => {
        it("should return children of a section", () => {
            const root = createNestedTestRootNode();
            const children = getChildrenOfNode(root, FernNavigation.NodeId("section-outer"));
            expect(children).toHaveLength(2);
            expect(children?.[0]?.id).toBe("page-c");
        });

        it("should return children of a sidebarGroup", () => {
            const root = createNestedTestRootNode();
            const children = getChildrenOfNode(root, FernNavigation.NodeId("sidebar-group"));
            expect(children).toHaveLength(2);
            expect(children?.[0]?.id).toBe("page-a");
        });

        it("should return undefined for leaf node", () => {
            const root = createNestedTestRootNode();
            expect(getChildrenOfNode(root, FernNavigation.NodeId("page-a"))).toBeUndefined();
        });

        it("should return undefined for missing node", () => {
            const root = createNestedTestRootNode();
            expect(getChildrenOfNode(root, FernNavigation.NodeId("nonexistent"))).toBeUndefined();
        });
    });

    describe("removeNodeById", () => {
        it("should remove a page and return its parent ID", () => {
            const root = createNestedTestRootNode();
            const result = removeNodeById(root, FernNavigation.NodeId("page-c"));
            expect(result).toBeDefined();
            expect(result!.parentId).toBe("section-outer");

            // Verify page-c is gone
            expect(findNodeById(result!.updatedRoot, FernNavigation.NodeId("page-c"))).toBeUndefined();

            // Verify other nodes are intact
            expect(findNodeById(result!.updatedRoot, FernNavigation.NodeId("page-d"))).toBeDefined();
        });

        it("should remove a section and return its parent ID", () => {
            const root = createNestedTestRootNode();
            const result = removeNodeById(root, FernNavigation.NodeId("section-inner"));
            expect(result).toBeDefined();
            expect(result!.parentId).toBe("section-outer");

            // Inner section and its children should be gone
            expect(findNodeById(result!.updatedRoot, FernNavigation.NodeId("section-inner"))).toBeUndefined();
            expect(findNodeById(result!.updatedRoot, FernNavigation.NodeId("page-d"))).toBeUndefined();

            // page-c should still be there
            expect(findNodeById(result!.updatedRoot, FernNavigation.NodeId("page-c"))).toBeDefined();
        });

        it("should return undefined when node not found", () => {
            const root = createNestedTestRootNode();
            expect(removeNodeById(root, FernNavigation.NodeId("nonexistent"))).toBeUndefined();
        });
    });

    describe("moveNodeInTree", () => {
        it("should move a page within the same parent", () => {
            const root = createNestedTestRootNode();
            // Move page-b before page-a in sidebar-group
            const result = moveNodeInTree(
                root,
                FernNavigation.NodeId("page-b"),
                FernNavigation.NodeId("sidebar-group"),
                0
            );
            expect(result).toBeDefined();
            const children = getChildrenOfNode(result!.updatedRoot, FernNavigation.NodeId("sidebar-group"));
            expect(children?.[0]?.id).toBe("page-b");
            expect(children?.[1]?.id).toBe("page-a");
        });

        it("should move a page between parents", () => {
            const root = createNestedTestRootNode();
            // Move page-a from sidebar-group to section-sibling
            const result = moveNodeInTree(
                root,
                FernNavigation.NodeId("page-a"),
                FernNavigation.NodeId("section-sibling"),
                0
            );
            expect(result).toBeDefined();

            // page-a should be in section-sibling now
            const siblingChildren = getChildrenOfNode(result!.updatedRoot, FernNavigation.NodeId("section-sibling"));
            expect(siblingChildren?.[0]?.id).toBe("page-a");
            expect(siblingChildren?.[1]?.id).toBe("page-e");

            // page-a should be gone from sidebar-group
            const groupChildren = getChildrenOfNode(result!.updatedRoot, FernNavigation.NodeId("sidebar-group"));
            expect(groupChildren).toHaveLength(1);
            expect(groupChildren?.[0]?.id).toBe("page-b");
        });

        it("should move a section", () => {
            const root = createNestedTestRootNode();
            // Move section-inner from section-outer to section-sibling
            const result = moveNodeInTree(
                root,
                FernNavigation.NodeId("section-inner"),
                FernNavigation.NodeId("section-sibling"),
                0
            );
            expect(result).toBeDefined();

            // section-inner should be in section-sibling
            const siblingChildren = getChildrenOfNode(result!.updatedRoot, FernNavigation.NodeId("section-sibling"));
            expect(siblingChildren?.[0]?.id).toBe("section-inner");

            // section-outer should only have page-c now
            const outerChildren = getChildrenOfNode(result!.updatedRoot, FernNavigation.NodeId("section-outer"));
            expect(outerChildren).toHaveLength(1);
            expect(outerChildren?.[0]?.id).toBe("page-c");
        });

        it("should adjust index for same-parent move (higher to lower)", () => {
            const root = createNestedTestRootNode();
            // Move page-b (index 1) to index 0 in sidebar-group
            const result = moveNodeInTree(
                root,
                FernNavigation.NodeId("page-b"),
                FernNavigation.NodeId("sidebar-group"),
                0
            );
            expect(result).toBeDefined();
            const children = getChildrenOfNode(result!.updatedRoot, FernNavigation.NodeId("sidebar-group"));
            expect(children?.[0]?.id).toBe("page-b");
            expect(children?.[1]?.id).toBe("page-a");
        });
    });

    describe("computeSidebarRootFlatIndex", () => {
        it("should convert tree index to flat index across sidebarGroups", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sg-1"),
                        children: [mkPage("p1"), mkPage("p2")]
                    },
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sg-2"),
                        children: [mkPage("p3")]
                    },
                    mkSection("s1", "Section 1")
                ]
            };

            // Index 0 = first child of sidebarRoot = sg-1 → flat 0
            expect(computeSidebarRootFlatIndex(sidebarRoot, 0)).toBe(0);
            // Index 1 = sg-2 → its flat start is after sg-1's 2 children = flat 2
            expect(computeSidebarRootFlatIndex(sidebarRoot, 1)).toBe(2);
            // Index 2 = s1 → after sg-1's 2 + sg-2's 1 = flat 3
            expect(computeSidebarRootFlatIndex(sidebarRoot, 2)).toBe(3);
        });

        it("should handle index at end (append)", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("sg-1"),
                        children: [mkPage("p1")]
                    }
                ]
            };

            // Index past end → total flat count
            expect(computeSidebarRootFlatIndex(sidebarRoot, 1)).toBe(1);
        });

        it("should return 0 for empty sidebarRoot", () => {
            const sidebarRoot: FernNavigation.SidebarRootNode = {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar-root"),
                children: []
            };

            expect(computeSidebarRootFlatIndex(sidebarRoot, 0)).toBe(0);
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
            expect(rootLevelContainers[0]?.type).toBe("sidebarRoot");
            expect(rootLevelContainers[0]?.id).toBe("sidebar-root");
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

            // Should return exactly one entry, always targeting sidebarRoot
            expect(rootLevelContainers).toHaveLength(1);
            expect(rootLevelContainers[0]?.type).toBe("sidebarRoot");
            expect(rootLevelContainers[0]?.id).toBe("sidebar-root");
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

            // Verify children property exists — sidebarGroup children are flattened
            // so duplicate slug validation can find page nodes directly
            expect(rootLevelContainer).toBeDefined();
            expect(rootLevelContainer).toHaveProperty("children");
            expect(Array.isArray(rootLevelContainer?.children)).toBe(true);

            // Verify we can check for duplicate slugs using the flattened children
            const hasDuplicate =
                "children" in rootLevelContainer! &&
                rootLevelContainer.children
                    ?.filter((child: any) => child.type === "page")
                    .some((page: any) => page.slug === "existing-page");

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
