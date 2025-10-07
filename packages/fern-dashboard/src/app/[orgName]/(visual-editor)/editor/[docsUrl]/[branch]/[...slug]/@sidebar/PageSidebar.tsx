"use client";

import type { DangerousTransmittableDocsLoaderData } from "@fern-api/docs-loader";
import { getIsSidebarFixed, getIsSingleOverviewPage } from "@fern-api/docs-utils";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import {
    type ClientPageDataDependencies,
    mergeFoundNodes,
    type ResolvedPageData,
    type SerializableFoundNode,
    type ServerPageDataDependencies,
    useNavigation
} from "@fern-docs/components/navigation";
import { SidebarClientRootNode } from "@fern-docs/components/sidebar/nodes/SidebarClientRootNode";
import { SidebarClientTabsRoot } from "@fern-docs/components/sidebar/SidebarClientTabsRoot";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";
import { useRef } from "react";

import { CreatePageButton } from "./CreatePageButton";

interface PageSidebarProps {
    /** Maintains compat with existing docs sidebar API */
    prefetchedLoaderData: DangerousTransmittableDocsLoaderData;
    /** Resolves to initial data for page nodes */
    pageDataDeps?: ClientPageDataDependencies | ServerPageDataDependencies;
    /** Directly accepts found node from loader for non-page nodes (e.g. "endpoint") */
    fallbackFoundNode?: SerializableFoundNode;
}

export default function PageSidebar({ prefetchedLoaderData, pageDataDeps, fallbackFoundNode }: PageSidebarProps) {
    const { hydrated, resolveInitialPageData } = useNavigation();

    // Store initial page data in a ref so we don't re-resolve it on every render
    const initialPageDataRef = useRef<ResolvedPageData>(null);

    let found: SerializableFoundNode | undefined;

    if (pageDataDeps) {
        const initialPageData =
            hydrated && !initialPageDataRef.current
                ? (initialPageDataRef.current = resolveInitialPageData(pageDataDeps))
                : initialPageDataRef.current;

        if (!initialPageData) {
            // TODO: show a loading state
            return null;
        }

        found = mergeFoundNodes(initialPageData.foundNode, fallbackFoundNode);
    } else if (fallbackFoundNode) {
        found = fallbackFoundNode;
    } else {
        throw new Error("Either pageDataDeps or fallbackFoundNode must be provided");
    }

    // these are all the "visible" nodes to prevent pruning if any of these nodes are hidden
    const visibleNodes = [...found.parents, found.node];
    const visibleNodeIds = visibleNodes.map((node) => node.id);

    const isSingleOverviewPage = getIsSingleOverviewPage(found as FernNavigation.utils.Node.Found);
    const isSidebarFixed = getIsSidebarFixed(prefetchedLoaderData.config);

    return (
        <>
            {!pageDataDeps && fallbackFoundNode && (
                // For fallback nodes (non-page nodes like "endpoint"), set navigation state here
                // PageNode currently does not render SetCurrentNavigationNode for non-pages
                // TODO: restructure the app so that SetCurrentNavigationNode is always rendered
                <SetCurrentNavigationNode
                    nodeId={found.node.id}
                    sidebarRootNodeId={found.sidebar?.id}
                    tabId={found.currentTab?.id}
                    productId={found.currentProduct?.productId}
                    productSlug={found.currentProduct?.slug}
                    versionId={found.currentVersion?.versionId}
                    versionSlug={found.currentVersion?.slug}
                    versionIsDefault={found.isCurrentVersionDefault}
                    productIsDefault={found.isCurrentProductDefault}
                />
            )}
            {found.tabs && found.tabs.length > 0 && (
                <SidebarClientTabsRoot loaderData={prefetchedLoaderData}>
                    <SidebarTabsList tabs={found.tabs} forceClientRender={true} />
                </SidebarClientTabsRoot>
            )}
            {isSingleOverviewPage && !isSidebarFixed ? (
                <HiddenSidebar />
            ) : (
                <>
                    {/* Always use the current found node as the base when creating a new page */}
                    <CreatePageButton baseFoundNode={found} />
                    <SidebarClientRootNode
                        root={found.sidebar}
                        visibleNodeIds={visibleNodeIds}
                        loaderData={prefetchedLoaderData}
                        forceClientRender={true}
                    />
                </>
            )}
        </>
    );
}
