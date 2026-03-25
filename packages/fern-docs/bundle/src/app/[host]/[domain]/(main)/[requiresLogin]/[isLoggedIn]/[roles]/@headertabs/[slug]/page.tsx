import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { HeaderTabsList } from "@fern-docs/components/HeaderTabsList";
import { HeaderTabsListRoot } from "@fern-docs/components/HeaderTabsListRoot";

export const revalidate = false;

export default async function HeaderTabsPage({
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
    const layout = await loader.getLayout();

    if (layout.tabsPlacement !== "HEADER") {
        return null;
    }

    const root = await loader.getRoot();

    const authState = await loader.getAuthState();

    const showAuthenticatedNodes = (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable;

    const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));

    const tabs = getTabs(
        foundNode,
        root,
        slug,
        showAuthenticatedNodes,
        authState.authed ? (authState.user.roles ?? []) : []
    );

    if (tabs == null) {
        return null;
    }

    const files = await loader.getFiles();
    const initialTabId = foundNode.type === "found" ? foundNode.currentTab?.id : undefined;

    const centered = layout.tabsAlignment === "CENTER";

    return (
        <HeaderTabsListRoot initialTabId={initialTabId} centered={centered}>
            <HeaderTabsList tabs={tabs} files={files} />
        </HeaderTabsListRoot>
    );
}
