import { FernNavigation } from "../../..";
import { Pruner } from "../pruneNavigationTree";

describe("pruneNavigationTree", () => {
    it("should not prune the tree if keep returns true for all nodes", () => {
        const root: FernNavigation.NavigationNode = {
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            overviewPageId: undefined,
            noindex: undefined,
            pointsTo: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        };

        const result = Pruner.from(root)
            .keep(() => true)
            .get();

        // structuredClone should duplicate the object
        expect(result === root).toBe(false);

        expect(result).toStrictEqual({
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            overviewPageId: undefined,
            noindex: undefined,
            pointsTo: FernNavigation.Slug("root/page"),
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        });
    });

    it("should return undefined if no visitable pages are left", () => {
        const root: FernNavigation.NavigationNode = {
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            overviewPageId: undefined,
            noindex: undefined,
            pointsTo: FernNavigation.Slug("root/page"),
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        };

        const result = Pruner.from(root)
            .keep((node) => node.id !== FernNavigation.NodeId("page"))
            .get();

        expect(result).toBeUndefined();
    });

    it("should not prune section children even if section itself is pruned", () => {
        const root: FernNavigation.NavigationNode = {
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            overviewPageId: FernNavigation.PageId("overview.mdx"), // this is a visitable page
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        };

        const result = Pruner.from(root)
            .keep((node) => node.id !== "root")
            .get();

        // structuredClone should duplicate the object
        expect(result === root).toBe(false);

        expect(result).toStrictEqual({
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            overviewPageId: undefined, // this should be deleted
            title: "Root",
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: FernNavigation.Slug("root/page"),
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        });
    });

    it("should not prune section even if children are pruned", () => {
        const root: FernNavigation.NavigationNode = {
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            overviewPageId: FernNavigation.PageId("overview.mdx"), // this is a visitable page
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        };

        const result = Pruner.from(root)
            .keep((node) => node.id !== "page")
            .get();

        // structuredClone should duplicate the object
        expect(result === root).toBe(false);

        expect(result).toStrictEqual({
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            overviewPageId: FernNavigation.PageId("overview.mdx"), // this is a visitable page
            title: "Root",
            children: [], // children is empty, but the section is still there because it has an overview page
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        });
    });

    it("should not prune non-leaf nodes", () => {
        const root: FernNavigation.NavigationNode = {
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            overviewPageId: undefined,
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        };

        const result = Pruner.from(root)
            .keep((node) => node.id !== "root")
            .get();

        // structuredClone should duplicate the object
        expect(result === root).toBe(false);

        expect(result).toStrictEqual({
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            overviewPageId: undefined, // this should be deleted
            title: "Root",
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: FernNavigation.Slug("root/page"),
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        });
    });

    it("should delete leaf node and its parent if no siblings left", () => {
        const root: FernNavigation.NavigationNode = {
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            title: "Root",
            overviewPageId: undefined,
            children: [
                {
                    type: "section",
                    id: FernNavigation.NodeId("section2"),
                    slug: FernNavigation.Slug("root/section2"),
                    title: "Section 2",
                    overviewPageId: undefined,
                    children: [
                        {
                            type: "page",
                            id: FernNavigation.NodeId("page1"),
                            slug: FernNavigation.Slug("root/section2/page"),
                            title: "Page",
                            pageId: FernNavigation.PageId("page.mdx"),
                            canonicalSlug: undefined,
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            noindex: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            availability: undefined
                        }
                    ],
                    collapsed: undefined,
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    pointsTo: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                },
                {
                    type: "page",
                    id: FernNavigation.NodeId("page2"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            pointsTo: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined
        };

        const result = Pruner.from(root)
            .keep((node) => node.id !== "page1")
            .get();

        // structuredClone should duplicate the object
        expect(result === root).toBe(false);

        expect(result).toStrictEqual({
            type: "section",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug("root"),
            overviewPageId: undefined, // this should be deleted
            title: "Root",
            children: [
                {
                    type: "page",
                    id: FernNavigation.NodeId("page2"),
                    slug: FernNavigation.Slug("root/page"),
                    title: "Page",
                    pageId: FernNavigation.PageId("page.mdx"),
                    canonicalSlug: undefined,
                    icon: undefined,
                    hidden: undefined,
                    authed: undefined,
                    noindex: undefined,
                    viewers: undefined,
                    orphaned: undefined,
                    featureFlags: undefined,
                    availability: undefined
                }
            ],
            collapsed: undefined,
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            noindex: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined,
            // NOTE: points to is updated!
            pointsTo: "root/page"
        });
    });

    it("should handle versioned root with landing pages and no pointsTo field", () => {
        const root: FernNavigation.NavigationNode = {
            type: "root",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug(""),
            title: "Root",
            version: "v2",
            roles: undefined,
            child: {
                type: "versioned",
                id: FernNavigation.NodeId("versioned"),
                children: [
                    {
                        type: "version",
                        id: FernNavigation.NodeId("v1"),
                        slug: FernNavigation.Slug("v1"),
                        title: "Version 1",
                        default: false,
                        versionId: FernNavigation.VersionId("v1"),
                        landingPage: {
                            type: "landingPage",
                            id: FernNavigation.NodeId("v1-landing"),
                            slug: FernNavigation.Slug("v1/welcome"),
                            title: "V1 Landing",
                            pageId: FernNavigation.PageId("index.mdx"),
                            canonicalSlug: FernNavigation.Slug("welcome"),
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            noindex: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined
                        },
                        child: {
                            type: "sidebarRoot",
                            id: FernNavigation.NodeId("v1-sidebar"),
                            children: [
                                {
                                    type: "section",
                                    id: FernNavigation.NodeId("v1-section"),
                                    slug: FernNavigation.Slug("v1"),
                                    title: "V1 Section",
                                    overviewPageId: undefined,
                                    children: [
                                        {
                                            type: "page",
                                            id: FernNavigation.NodeId("v1-page"),
                                            slug: FernNavigation.Slug("v1/page"),
                                            title: "V1 Page",
                                            pageId: FernNavigation.PageId("v1-page.mdx"),
                                            canonicalSlug: undefined,
                                            icon: undefined,
                                            hidden: undefined,
                                            authed: undefined,
                                            noindex: undefined,
                                            viewers: undefined,
                                            orphaned: undefined,
                                            featureFlags: undefined,
                                            availability: undefined
                                        }
                                    ],
                                    collapsed: undefined,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    noindex: undefined,
                                    pointsTo: undefined, // no pointsTo field
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    availability: undefined
                                }
                            ]
                        },
                        availability: undefined,
                        canonicalSlug: undefined,
                        icon: undefined,
                        hidden: undefined,
                        authed: undefined,
                        pointsTo: undefined, // no pointsTo field
                        viewers: undefined,
                        orphaned: undefined,
                        featureFlags: undefined,
                        announcement: undefined
                    },
                    {
                        type: "version",
                        id: FernNavigation.NodeId("v2"),
                        slug: FernNavigation.Slug("v2"),
                        title: "Version 2",
                        default: true,
                        versionId: FernNavigation.VersionId("v2"),
                        landingPage: {
                            type: "landingPage",
                            id: FernNavigation.NodeId("v2-landing"),
                            slug: FernNavigation.Slug("v2/welcome"),
                            title: "V2 Landing",
                            pageId: FernNavigation.PageId("index.mdx"),
                            canonicalSlug: FernNavigation.Slug("welcome"),
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            noindex: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined
                        },
                        child: {
                            type: "sidebarRoot",
                            id: FernNavigation.NodeId("v2-sidebar"),
                            children: [
                                {
                                    type: "section",
                                    id: FernNavigation.NodeId("v2-section"),
                                    slug: FernNavigation.Slug("welcome"),
                                    title: "V2 Section",
                                    overviewPageId: undefined,
                                    children: [
                                        {
                                            type: "page",
                                            id: FernNavigation.NodeId("v2-page"),
                                            slug: FernNavigation.Slug("page"),
                                            title: "V2 Page",
                                            pageId: FernNavigation.PageId("v2-page.mdx"),
                                            canonicalSlug: undefined,
                                            icon: undefined,
                                            hidden: undefined,
                                            authed: undefined,
                                            noindex: undefined,
                                            viewers: undefined,
                                            orphaned: undefined,
                                            featureFlags: undefined,
                                            availability: undefined
                                        }
                                    ],
                                    collapsed: undefined,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    noindex: undefined,
                                    pointsTo: undefined, // no pointsTo field
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    availability: undefined
                                }
                            ]
                        },
                        availability: undefined,
                        canonicalSlug: undefined,
                        icon: undefined,
                        hidden: undefined,
                        authed: undefined,
                        pointsTo: undefined, // no pointsTo field
                        viewers: undefined,
                        orphaned: undefined,
                        featureFlags: undefined,
                        announcement: undefined
                    }
                ]
            },
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            pointsTo: undefined, // no pointsTo field
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined
        };

        const result = Pruner.from(root)
            .keep((node) => node.id !== "v1-page")
            .get();

        // structuredClone should duplicate the object
        expect(result === root).toBe(false);

        expect(result).toStrictEqual({
            type: "root",
            id: FernNavigation.NodeId("root"),
            slug: FernNavigation.Slug(""),
            title: "Root",
            version: "v2",
            roles: undefined,
            child: {
                type: "versioned",
                id: FernNavigation.NodeId("versioned"),
                children: [
                    {
                        type: "version",
                        id: FernNavigation.NodeId("v1"),
                        slug: FernNavigation.Slug("v1"),
                        title: "Version 1",
                        default: false,
                        versionId: FernNavigation.VersionId("v1"),
                        landingPage: {
                            type: "landingPage",
                            id: FernNavigation.NodeId("v1-landing"),
                            slug: FernNavigation.Slug("v1/welcome"),
                            title: "V1 Landing",
                            pageId: FernNavigation.PageId("index.mdx"),
                            canonicalSlug: FernNavigation.Slug("welcome"),
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            noindex: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined
                        },
                        child: {
                            type: "sidebarRoot",
                            id: FernNavigation.NodeId("v1-sidebar"),
                            children: []
                        },
                        availability: undefined,
                        canonicalSlug: undefined,
                        icon: undefined,
                        hidden: undefined,
                        authed: undefined,
                        pointsTo: "v1/welcome",
                        viewers: undefined,
                        orphaned: undefined,
                        featureFlags: undefined,
                        announcement: undefined
                    },
                    {
                        type: "version",
                        id: FernNavigation.NodeId("v2"),
                        slug: FernNavigation.Slug("v2"),
                        title: "Version 2",
                        default: true,
                        versionId: FernNavigation.VersionId("v2"),
                        landingPage: {
                            type: "landingPage",
                            id: FernNavigation.NodeId("v2-landing"),
                            slug: FernNavigation.Slug("v2/welcome"),
                            title: "V2 Landing",
                            pageId: FernNavigation.PageId("index.mdx"),
                            canonicalSlug: FernNavigation.Slug("welcome"),
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            noindex: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined
                        },
                        child: {
                            type: "sidebarRoot",
                            id: FernNavigation.NodeId("v2-sidebar"),
                            children: [
                                {
                                    type: "section",
                                    id: FernNavigation.NodeId("v2-section"),
                                    slug: FernNavigation.Slug("welcome"),
                                    title: "V2 Section",
                                    overviewPageId: undefined,
                                    children: [
                                        {
                                            type: "page",
                                            id: FernNavigation.NodeId("v2-page"),
                                            slug: FernNavigation.Slug("page"),
                                            title: "V2 Page",
                                            pageId: FernNavigation.PageId("v2-page.mdx"),
                                            canonicalSlug: undefined,
                                            icon: undefined,
                                            hidden: undefined,
                                            authed: undefined,
                                            noindex: undefined,
                                            viewers: undefined,
                                            orphaned: undefined,
                                            featureFlags: undefined,
                                            availability: undefined
                                        }
                                    ],
                                    collapsed: undefined,
                                    canonicalSlug: undefined,
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    noindex: undefined,
                                    pointsTo: "page",
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    availability: undefined
                                }
                            ]
                        },
                        availability: undefined,
                        canonicalSlug: undefined,
                        icon: undefined,
                        hidden: undefined,
                        authed: undefined,
                        pointsTo: "v2/welcome",
                        viewers: undefined,
                        orphaned: undefined,
                        featureFlags: undefined,
                        announcement: undefined
                    }
                ]
            },
            canonicalSlug: undefined,
            icon: undefined,
            hidden: undefined,
            authed: undefined,
            pointsTo: "welcome", // unversioned pointsTo field
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined
        });
    });
});
