import { describe, expect, it } from "vitest";

import { FernNavigation } from "../../..";
import { FernNavigationV1ToLatest } from "../v1ToV2";

describe("FernNavigationV1ToLatest collapsed", () => {
    it("preserves collapsed values (including open-by-default)", () => {
        const v1: FernNavigation.V1.RootNode = {
            type: "root",
            version: "v1",
            id: FernNavigation.V1.NodeId("root"),
            collapsed: undefined,
            title: "Root",
            slug: FernNavigation.V1.Slug(""),
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
                id: FernNavigation.V1.NodeId("unversioned"),
                collapsed: undefined,
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: FernNavigation.V1.NodeId("sidebar"),
                    collapsed: undefined,
                    children: [
                        {
                            type: "section",
                            id: FernNavigation.V1.NodeId("section"),
                            collapsed: "open-by-default",
                            title: "Section",
                            slug: FernNavigation.V1.Slug("section"),
                            icon: undefined,
                            hidden: undefined,
                            authed: undefined,
                            viewers: undefined,
                            orphaned: undefined,
                            featureFlags: undefined,
                            overviewPageId: undefined,
                            noindex: undefined,
                            pointsTo: undefined,
                            collapsible: undefined,
                            collapsedByDefault: undefined,
                            availability: undefined,
                            children: [
                                {
                                    type: "page",
                                    id: FernNavigation.V1.NodeId("page"),
                                    collapsed: false,
                                    title: "Page",
                                    slug: FernNavigation.V1.Slug("section/page"),
                                    icon: undefined,
                                    hidden: undefined,
                                    authed: undefined,
                                    viewers: undefined,
                                    orphaned: undefined,
                                    featureFlags: undefined,
                                    pageId: FernNavigation.PageId("page.mdx"),
                                    noindex: undefined,
                                    availability: undefined
                                }
                            ]
                        }
                    ]
                }
            }
        };

        const latest = FernNavigationV1ToLatest.create().root(v1);

        expect(Object.hasOwn(latest, "collapsed")).toBe(true);

        const unversioned = latest.child;
        if (unversioned.type !== "unversioned") {
            throw new Error("Expected unversioned");
        }
        expect(Object.hasOwn(unversioned, "collapsed")).toBe(true);

        const sidebarRoot = unversioned.child;
        if (sidebarRoot.type !== "sidebarRoot") {
            throw new Error("Expected sidebarRoot");
        }
        expect(Object.hasOwn(sidebarRoot, "collapsed")).toBe(true);

        const section = sidebarRoot.children[0];
        expect(section).toBeDefined();
        if (section == null || section.type !== "section") {
            throw new Error("Expected section");
        }
        expect(Object.hasOwn(section, "collapsed")).toBe(true);
        expect(section.collapsed).toBe("open-by-default");

        const page = section.children[0];
        expect(page).toBeDefined();
        if (page == null || page.type !== "page") {
            throw new Error("Expected page");
        }
        expect(Object.hasOwn(page, "collapsed")).toBe(true);
        expect(page.collapsed).toBe(false);
    });
});
