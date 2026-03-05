import { FernNavigation } from "../..";
import { NodeCollector } from "../NodeCollector";

function makePage(opts: { id: string; slug: string; authed?: boolean; viewers?: string[] }): FernNavigation.PageNode {
    return {
        type: "page",
        id: FernNavigation.NodeId(opts.id),
        slug: FernNavigation.Slug(opts.slug),
        title: opts.id,
        pageId: FernNavigation.PageId(`${opts.id}.mdx`),
        canonicalSlug: undefined,
        icon: undefined,
        hidden: undefined,
        authed: opts.authed ?? undefined,
        noindex: undefined,
        viewers: opts.viewers as FernNavigation.RoleId[] | undefined,
        orphaned: undefined,
        featureFlags: undefined,
        availability: undefined
    };
}

function makeRoot(opts: { pages: FernNavigation.PageNode[]; roles?: string[] }): FernNavigation.RootNode {
    return {
        type: "root",
        version: "v2",
        id: FernNavigation.NodeId("root"),
        slug: FernNavigation.Slug(""),
        title: "Root",
        roles: opts.roles as FernNavigation.RoleId[] | undefined,
        canonicalSlug: undefined,
        icon: undefined,
        hidden: undefined,
        authed: undefined,
        pointsTo: undefined,
        viewers: undefined,
        orphaned: undefined,
        featureFlags: undefined,
        child: {
            type: "unversioned",
            id: FernNavigation.NodeId("unversioned"),
            landingPage: undefined,
            child: {
                type: "sidebarRoot",
                id: FernNavigation.NodeId("sidebar"),
                children: [
                    {
                        type: "sidebarGroup",
                        id: FernNavigation.NodeId("group"),
                        children: opts.pages
                    }
                ]
            }
        }
    };
}

describe("NodeCollector.revalidationPageSlugs", () => {
    it("should categorize unauthed pages correctly", () => {
        const root = makeRoot({
            pages: [
                makePage({ id: "public-page", slug: "public" }),
                makePage({ id: "another-public", slug: "another" })
            ]
        });

        const collector = NodeCollector.collect(root);
        const { authedSlugs, unauthedSlugs, authedRoles } = collector.revalidationPageSlugs;

        expect(unauthedSlugs).toEqual(expect.arrayContaining(["public", "another"]));
        expect(authedSlugs).toHaveLength(0);
        expect(authedRoles).toHaveLength(0);
    });

    it("should categorize authed pages with no roles (viewers undefined)", () => {
        const root = makeRoot({
            pages: [
                makePage({ id: "public-page", slug: "public" }),
                makePage({ id: "authed-page", slug: "authed", authed: true })
            ]
        });

        const collector = NodeCollector.collect(root);
        const { authedSlugs, unauthedSlugs, authedRoles } = collector.revalidationPageSlugs;

        expect(unauthedSlugs).toEqual(["public"]);
        expect(authedSlugs).toEqual(["authed"]);
        expect(authedRoles).toHaveLength(0);
    });

    it("should collect roles from authed pages with viewers defined", () => {
        const root = makeRoot({
            pages: [
                makePage({ id: "public-page", slug: "public" }),
                makePage({ id: "admin-page", slug: "admin-only", authed: true, viewers: ["admin"] }),
                makePage({ id: "dev-page", slug: "dev-only", authed: true, viewers: ["developer"] })
            ]
        });

        const collector = NodeCollector.collect(root);
        const { authedSlugs, unauthedSlugs, authedRoles } = collector.revalidationPageSlugs;

        expect(unauthedSlugs).toEqual(["public"]);
        expect(authedSlugs).toEqual(expect.arrayContaining(["admin-only", "dev-only"]));
        expect(authedSlugs).toHaveLength(2);
        expect(authedRoles).toEqual(expect.arrayContaining(["admin", "developer"]));
        expect(authedRoles).toHaveLength(2);
    });

    it("should deduplicate roles across multiple pages", () => {
        const root = makeRoot({
            pages: [
                makePage({ id: "page-a", slug: "a", authed: true, viewers: ["admin", "developer"] }),
                makePage({ id: "page-b", slug: "b", authed: true, viewers: ["admin", "support"] })
            ]
        });

        const collector = NodeCollector.collect(root);
        const { authedRoles } = collector.revalidationPageSlugs;

        expect(authedRoles).toEqual(expect.arrayContaining(["admin", "developer", "support"]));
        expect(authedRoles).toHaveLength(3);
    });

    it("should handle mix of unauthed, authed without roles, and authed with roles", () => {
        const root = makeRoot({
            pages: [
                makePage({ id: "public", slug: "public" }),
                makePage({ id: "login-only", slug: "login-only", authed: true }),
                makePage({ id: "admin-page", slug: "admin", authed: true, viewers: ["admin"] }),
                makePage({
                    id: "multi-role",
                    slug: "multi",
                    authed: true,
                    viewers: ["admin", "developer"]
                })
            ]
        });

        const collector = NodeCollector.collect(root);
        const { authedSlugs, unauthedSlugs, authedRoles } = collector.revalidationPageSlugs;

        expect(unauthedSlugs).toEqual(["public"]);
        expect(authedSlugs).toEqual(expect.arrayContaining(["login-only", "admin", "multi"]));
        expect(authedSlugs).toHaveLength(3);
        expect(authedRoles).toEqual(expect.arrayContaining(["admin", "developer"]));
        expect(authedRoles).toHaveLength(2);
    });

    it("should handle empty navigation tree", () => {
        const collector = NodeCollector.collect(undefined);
        const { authedSlugs, unauthedSlugs, authedRoles } = collector.revalidationPageSlugs;

        expect(unauthedSlugs).toHaveLength(0);
        expect(authedSlugs).toHaveLength(0);
        expect(authedRoles).toHaveLength(0);
    });

    it("should handle authed pages with empty viewers array", () => {
        const root = makeRoot({
            pages: [makePage({ id: "empty-viewers", slug: "empty", authed: true, viewers: [] })]
        });

        const collector = NodeCollector.collect(root);
        const { authedSlugs, authedRoles } = collector.revalidationPageSlugs;

        expect(authedSlugs).toEqual(["empty"]);
        expect(authedRoles).toHaveLength(0);
    });
});
