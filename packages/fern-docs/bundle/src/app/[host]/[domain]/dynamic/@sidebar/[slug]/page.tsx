import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import {
    getIsSidebarFixed,
    getIsSingleOverviewPage,
    getRedirectForPath,
    prepareRedirect,
    slugToHref
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { SidebarRootNode } from "@fern-docs/components/sidebar/nodes/SidebarRootNode";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SidebarTabsRoot } from "@fern-docs/components/sidebar/SidebarTabsRoot";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";
import { permanentRedirect, redirect } from "next/navigation";

import { getFernToken } from "@/app/fern-token";

export default async function SidebarPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const [config, baseUrl] = await Promise.all([loader.getConfig(), loader.getMetadata()]);
    const isSidebarFixed = getIsSidebarFixed(config);

    const showHiddenNodes = (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable;

    // Check for configured redirects FIRST (before findNode)
    const configuredRedirect = getRedirectForPath(slugToHref(slugjoin(slug)), baseUrl, config.redirects);
    if (configuredRedirect != null) {
        const redirectFn = configuredRedirect.permanent ? permanentRedirect : redirect;
        redirectFn(prepareRedirect(configuredRedirect.destination));
    }

    const root = await loader.getRoot();

    const authState = await loader.getAuthState();

    // preload:
    await loader.getLayout();

    const found = FernNavigation.utils.findNode(root, slugjoin(slug));
    if (found.type !== "found") {
        // explicitly redirect the sidebar slot for dynamic pages to avoid race condition => empty sidebar
        if (found.type === "redirect") {
            redirect(prepareRedirect(found.redirect));
        }

        return null;
    }

    // these are all the "visible" nodes to prevent pruning if any of these nodes are hidden
    const visibleNodes = [...found.parents, found.node];
    const visibleNodeIds = visibleNodes.map((node) => node.id);

    const isSingleOverviewPage = getIsSingleOverviewPage(found);

    const tabs = getTabs(found, root, slug, showHiddenNodes, authState.authed ? (authState.user.roles ?? []) : []);

    const files = await loader.getFiles();
    const lang = await loader.getLanguage();

    return (
        <>
            {tabs && tabs.length > 0 && (
                <SidebarTabsRoot loader={loader}>
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
                />
            )}
        </>
    );
}
