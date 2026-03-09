import { NodeId, type RootNode, type SidebarRootChild, Slug } from "@fern-api/fdr-sdk/navigation";

import { createNestedSectionNode, createPageNode, createSectionNode } from "./utils/create-node";
import { withPrunedNavigation } from "./withPrunedNavigation";

function createRootNode(sectionChildren: SidebarRootChild[]): RootNode {
    return {
        type: "root",
        child: {
            id: NodeId("1"),
            collapsed: undefined,
            landingPage: undefined,
            type: "unversioned",
            child: {
                type: "sidebarRoot",
                id: NodeId("2"),
                collapsed: undefined,
                children: sectionChildren
            }
        },
        version: "v2",
        title: "Root",
        slug: Slug("root"),
        canonicalSlug: undefined,
        authed: undefined,
        collapsed: undefined,
        icon: undefined,
        hidden: false,
        id: NodeId("4"),
        viewers: undefined,
        orphaned: undefined,
        pointsTo: undefined,
        roles: [],
        featureFlags: []
    };
}

describe("withPrunedNavigation", () => {
    it("child should be hidden if parent is hidden", () => {
        expect(
            withPrunedNavigation(createRootNode([createSectionNode("3", [createPageNode("1")])]), {
                visibleNodeIds: [],
                authed: false
            })
        ).toStrictEqual(createRootNode([]));
    });

    it("hidden parent should be visible is child is visible", () => {
        expect(
            withPrunedNavigation(createRootNode([createSectionNode("3", [createPageNode("5")])]), {
                visibleNodeIds: [NodeId("5"), NodeId("3")],
                authed: false
            })
        ).toStrictEqual(createRootNode([createSectionNode("3", [createPageNode("5")])]));
    });

    it("deeply hidden child should be hidden if parent is hidden", () => {
        expect(
            withPrunedNavigation(
                createRootNode([createSectionNode("3", [createNestedSectionNode("5", [createPageNode("1")])])]),
                {
                    visibleNodeIds: [],
                    authed: false
                }
            )
        ).toStrictEqual(createRootNode([]));
    });

    it("parent should be visible is deeply hidden child is visible", () => {
        expect(
            withPrunedNavigation(
                createRootNode([createSectionNode("3", [createNestedSectionNode("5", [createPageNode("6")])])]),
                {
                    visibleNodeIds: [NodeId("6"), NodeId("5"), NodeId("3")],
                    authed: false
                }
            )
        ).toStrictEqual(
            createRootNode([createSectionNode("3", [createNestedSectionNode("5", [createPageNode("6")])])])
        );
    });

    it("children should be hidden if parent is hidden", () => {
        expect(
            withPrunedNavigation(createRootNode([createSectionNode("3", [createPageNode("1"), createPageNode("1")])]), {
                visibleNodeIds: [],
                authed: false
            })
        ).toStrictEqual(createRootNode([]));
    });

    it("hidden parent and sibling should be visible is child is visible", () => {
        expect(
            withPrunedNavigation(createRootNode([createSectionNode("3", [createPageNode("5"), createPageNode("6")])]), {
                visibleNodeIds: [NodeId("5"), NodeId("3")],
                authed: false
            })
        ).toStrictEqual(createRootNode([createSectionNode("3", [createPageNode("5"), createPageNode("6")])]));
    });

    it("deeply hidden children should be hidden if parent is hidden", () => {
        expect(
            withPrunedNavigation(
                createRootNode([
                    createSectionNode("3", [createNestedSectionNode("5", [createPageNode("1"), createPageNode("1")])])
                ]),
                {
                    visibleNodeIds: [],
                    authed: false
                }
            )
        ).toStrictEqual(createRootNode([]));
    });

    it("parent and sibling should be visible is deeply hidden child is visible", () => {
        expect(
            withPrunedNavigation(
                createRootNode([
                    createSectionNode("3", [createNestedSectionNode("5", [createPageNode("6"), createPageNode("7")])])
                ]),
                {
                    visibleNodeIds: [NodeId("7"), NodeId("5"), NodeId("3")],
                    authed: false
                }
            )
        ).toStrictEqual(
            createRootNode([
                createSectionNode("3", [createNestedSectionNode("5", [createPageNode("6"), createPageNode("7")])])
            ])
        );
    });
});
