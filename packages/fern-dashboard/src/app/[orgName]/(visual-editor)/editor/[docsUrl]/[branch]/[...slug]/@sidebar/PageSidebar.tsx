"use client";

import type { DangerousTransmittableDocsLoaderData } from "@fern-api/docs-loader";
import { PrefetchedDocsLoader } from "@fern-api/docs-loader/client";
import { getIsSidebarFixed, getIsSingleOverviewPage } from "@fern-api/docs-utils";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import {
    type ClientPageDataDependencies,
    type ResolvedPageData,
    type SerializableFoundNode,
    type ServerPageDataDependencies,
    useDerivedFoundNode,
    useNavigation
} from "@fern-docs/components/navigation";
import { SidebarClientRootNode } from "@fern-docs/components/sidebar/nodes/SidebarClientRootNode";
import { SidebarClientTabsRoot } from "@fern-docs/components/sidebar/SidebarClientTabsRoot";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";
import { useRef } from "react";
import { DeletablePageNodeWrapper } from "@/components/editor/DeletablePageNodeWrapper";
import { SidebarSectionWithMenu } from "@/components/editor/SidebarSectionWithMenu";
import { CreatePageButton } from "./CreatePageButton";

interface PageSidebarProps {
    /** Maintains compat with existing docs sidebar API */
    prefetchedLoaderData: DangerousTransmittableDocsLoaderData;
    /** Resolves to initial data for page nodes */
    pageDataDeps?: ClientPageDataDependencies | ServerPageDataDependencies;
    /** Directly accepts found node from loader for non-page nodes (e.g. "endpoint") */
    fallbackFoundNode?: SerializableFoundNode;
    /** Root node from server to store in NavigationStore */
    serializableRootNode?: FernNavigation.RootNode;
}

export default function PageSidebar({
    prefetchedLoaderData,
    pageDataDeps,
    fallbackFoundNode,
    serializableRootNode
}: PageSidebarProps) {
    const { resolveInitialPageData } = useNavigation();

    // Store initial page data in a ref so we don't re-resolve it on every render
    const initialPageDataRef = useRef<ResolvedPageData | null>(null);

    // Extract files from the loader data for custom icon support
    const loader = PrefetchedDocsLoader.fromSerializable(prefetchedLoaderData);
    const files = loader.getFiles();

    // Use useDerivedFoundNode to get the current foundNode from RootNode
    const { foundNode, hydrated } = useDerivedFoundNode({
        initialFoundNode: pageDataDeps ? initialPageDataRef.current?.foundNode : fallbackFoundNode,
        fallbackFoundNode,
        serializableRootNode
    });

    if (pageDataDeps) {
        const initialPageData =
            hydrated && !initialPageDataRef.current
                ? (initialPageDataRef.current = resolveInitialPageData(pageDataDeps))
                : initialPageDataRef.current;

        if (!initialPageData || !foundNode) {
            console.error("[PageSidebar] Initial page data was not able to be resolved:", {
                initialPageData,
                foundNode
            });
            return null;
        }
    }

    if (!foundNode) {
        console.error("[PageSidebar] Found node was not able to be resolved:", { foundNode });
        return null;
    }

    // foundNode from useDerivedFoundNode already includes fallbackFoundNode merge logic
    const found = foundNode;

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
                    productSlug={
                        found.currentProduct && FernNavigation.isInternalProductNode(found.currentProduct)
                            ? found.currentProduct.slug
                            : undefined
                    }
                    versionId={found.currentVersion?.versionId}
                    versionSlug={found.currentVersion?.slug}
                    variantId={found.currentVariant?.variantId}
                    versionIsDefault={found.isCurrentVersionDefault}
                    productIsDefault={found.isCurrentProductDefault}
                />
            )}
            {found.tabs && found.tabs.length > 0 && (
                <SidebarClientTabsRoot loaderData={prefetchedLoaderData}>
                    <SidebarTabsList tabs={found.tabs} forceClientRender={true} files={files} />
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
                        renderOptions={{
                            forceClientRender: true,
                            wrapPageNode: (node, component) => (
                                <DeletablePageNodeWrapper node={node} component={component} />
                            ),
                            wrapSectionNode: (node, trigger) => (
                                <SidebarSectionWithMenu node={node} trigger={trigger} />
                            ),
                            files
                        }}
                    />
                </>
            )}
        </>
    );
}
