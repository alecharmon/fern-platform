import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { HeaderTabsList } from "@fern-docs/components/HeaderTabsList";
import { HeaderTabsListRoot } from "@fern-docs/components/HeaderTabsListRoot";
import { getRootAliasAwareNavigationSlug } from "@fern-docs/components/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function HeaderTabsPage({
    params
}: {
    params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl; slug: string; branch: string }>;
}) {
    const { docsUrl, slug, branch } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }

    const host = await getHostFromHeaders();
    const loader = await getCachedEditableDocsLoader(host, docsUrl, session.accessToken, branch);
    const layout = await loader.getLayout();

    if (layout.tabsPlacement !== "HEADER") {
        return null;
    }

    const [root, authState, edgeFlags] = await Promise.all([
        loader.getRoot(),
        loader.getAuthState(),
        loader.getEdgeFlags()
    ]);

    const showAuthenticatedNodes = edgeFlags.isAuthenticatedPagesDiscoverable;

    const navigationSlug = getRootAliasAwareNavigationSlug(slugjoin(slug), root);
    const foundNode = FernNavigation.utils.findNode(root, navigationSlug);

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

    const initialTabId = foundNode.type === "found" ? foundNode.currentTab?.id : undefined;

    return (
        <HeaderTabsListRoot initialTabId={initialTabId}>
            <HeaderTabsList tabs={tabs} />
        </HeaderTabsListRoot>
    );
}
