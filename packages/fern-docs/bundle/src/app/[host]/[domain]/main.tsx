import "server-only";

import { notFound } from "next/navigation";

import { last } from "es-toolkit/array";

import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { getIsSidebarFixed } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";

import ApiEndpointPage from "@/components/api-reference/ApiEndpointPage";
import { EndpointStreamingEnabledToggle } from "@/components/api-reference/endpoints/EndpointStreamingEnabledToggle";
import { BottomNavigation } from "@/components/bottom-nav";
import ChangelogEntryPage from "@/components/changelog/ChangelogEntryPage";
import ChangelogPage, { ChangelogPageEntry, ChangelogPageOverview } from "@/components/changelog/ChangelogPage";
import { LayoutEvaluator } from "@/components/layouts/LayoutEvaluator";
import { MdxSerializer } from "@/server/mdx-serializer";

export async function DocsMainContent({
    loader,
    serialize,
    serializeNextMdx,
    node,
    parents,
    neighbors,
    breadcrumb
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    serializeNextMdx?: MdxSerializer;
    node: FernNavigation.NavigationNodePage;
    parents: readonly FernNavigation.NavigationNodeParent[];
    neighbors?: {
        prev?: {
            title: string;
            href: string;
            excerpt?: string;
        };
        next?: {
            title: string;
            href: string;
            excerpt?: string;
        };
    };
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
}) {
    const bottomNavigation = neighbors && <BottomNavigation neighbors={neighbors} serialize={serialize} />;

    if (node.type === "changelog") {
        // only render full page mode for changelog tabs
        const changelogType = parents[parents.length - 1]?.type ?? "sidebarGroup";
        const config = await loader.getConfig();
        const isSidebarFixed = getIsSidebarFixed(config);

        return (
            <ChangelogPage
                loader={loader}
                serialize={serialize}
                nodeId={node.id}
                breadcrumb={breadcrumb}
                isFullPage={changelogType === "tabbed" && !isSidebarFixed}
            />
        );
    }

    if (node.type === "changelogEntry") {
        const changelogNode = parents.findLast((parent) => parent.type === "changelog");
        if (changelogNode == null) {
            throw new Error("Changelog node not found");
        }
        return (
            <ChangelogEntryPage
                loader={loader}
                serialize={serialize}
                node={node}
                overview={
                    <ChangelogPageOverview
                        loader={loader}
                        serialize={serialize}
                        node={changelogNode}
                        breadcrumb={breadcrumb.slice(0, -3)}
                        showRssFeedButton={false}
                    />
                }
                bottomNavigation={bottomNavigation}
            >
                <ChangelogPageEntry loader={loader} node={node} serialize={serialize} />
            </ChangelogEntryPage>
        );
    }

    if (FernNavigation.isApiLeaf(node)) {
        const parent = last(parents);
        return (
            <ApiEndpointPage
                loader={loader}
                serialize={serializeNextMdx ?? serialize}
                node={node}
                breadcrumb={breadcrumb}
                bottomNavigation={bottomNavigation}
                action={parent?.type === "endpointPair" ? <EndpointStreamingEnabledToggle node={parent} /> : undefined}
            />
        );
    }

    const pageId = FernNavigation.getPageId(node);
    if (pageId != null) {
        return (
            <LayoutEvaluator
                loader={loader}
                serialize={serialize}
                fallbackTitle={node.title}
                pageId={pageId}
                breadcrumb={breadcrumb}
                bottomNavigation={bottomNavigation}
                slug={node.slug}
                availability={node.type === "page" || node.type === "section" ? node.availability : undefined}
            />
        );
    }

    console.error(`[DocsMainContent:${loader.domain}] Unknown node type: ${node.type}`);
    notFound();
}
