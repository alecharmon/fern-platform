import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import { getIsSidebarFixed, getIsSingleOverviewPage } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { SidebarRootNode } from "@fern-docs/components/sidebar/nodes/SidebarRootNode";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SidebarTabsRoot } from "@fern-docs/components/sidebar/SidebarTabsRoot";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";

export const revalidate = false;

export default async function SidebarPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain);
    const config = await loader.getConfig();
    const isSidebarFixed = getIsSidebarFixed(config);

    const root = await loader.getRoot();

    const authState = await loader.getAuthState();

    const showHiddenNodes = (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable;

    // preload:
    await loader.getLayout();

    const found = FernNavigation.utils.findNode(root, slugjoin(slug));
    if (found.type !== "found") {
        return null;
    }

    // these are all the "visible" nodes to prevent pruning if any of these nodes are hidden
    const visibleNodes = [...found.parents, found.node];
    const visibleNodeIds = visibleNodes.map((node) => node.id);

    const isSingleOverviewPage = getIsSingleOverviewPage(found);

    const tabs = getTabs(found, root, slug, showHiddenNodes, authState.authed ? (authState.user.roles ?? []) : []);

    return (
        <>
            {tabs && tabs.length > 0 && (
                <SidebarTabsRoot loader={loader}>
                    <SidebarTabsList tabs={tabs} />
                </SidebarTabsRoot>
            )}
            {isSingleOverviewPage && !isSidebarFixed ? (
                <HiddenSidebar />
            ) : (
                <SidebarRootNode
                    root={found.sidebar}
                    visibleNodeIds={visibleNodeIds}
                    loader={loader}
                    renderOptions={{
                        currentVariantId: found.currentVariant?.variantId
                    }}
                />
            )}
        </>
    );
}
