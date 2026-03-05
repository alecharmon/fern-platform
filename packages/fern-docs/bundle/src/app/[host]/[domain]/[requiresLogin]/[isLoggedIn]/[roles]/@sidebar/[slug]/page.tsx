import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import { decodeAuthContextFromParams, getIsSidebarFixed, getIsSingleOverviewPage } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { SidebarRootNode } from "@fern-docs/components/sidebar/nodes/SidebarRootNode";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SidebarTabsRoot } from "@fern-docs/components/sidebar/SidebarTabsRoot";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";

// ISR revalidation — keep in sync with sibling routes (see route-revalidate.ts)
export const revalidate = 60;

export default async function SidebarPage({
    params
}: {
    params: Promise<{
        host: string;
        domain: string;
        requiresLogin: string;
        isLoggedIn: string;
        roles: string;
        slug: string;
    }>;
}) {
    const { host, domain, slug, ...authParams } = await params;
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);
    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });
    const config = await loader.getConfig();
    const isSidebarFixed = getIsSidebarFixed(config);

    const root = await loader.getRoot();

    const authState = await loader.getAuthState();

    const showHiddenNodes = (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable;

    await loader.getLayout();

    const found = FernNavigation.utils.findNode(root, slugjoin(slug));
    if (found.type !== "found") {
        return null;
    }

    const visibleNodes = [...found.parents, found.node];
    const visibleNodeIds = visibleNodes.map((node) => node.id);

    const isSingleOverviewPage = getIsSingleOverviewPage(found);

    const tabs = getTabs(found, root, slug, showHiddenNodes, authState.authed ? (authState.user.roles ?? []) : []);

    const files = await loader.getFiles();
    const lang = await loader.getLanguage();

    return (
        <>
            {tabs && tabs.length > 0 && (
                <SidebarTabsRoot loader={loader} initialTabId={found.currentTab?.id}>
                    <SidebarTabsList tabs={tabs} files={files} />
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
                        currentVariantId: found.currentVariant?.variantId,
                        files
                    }}
                    lang={lang}
                    initialNodeId={found.node.id}
                />
            )}
        </>
    );
}
