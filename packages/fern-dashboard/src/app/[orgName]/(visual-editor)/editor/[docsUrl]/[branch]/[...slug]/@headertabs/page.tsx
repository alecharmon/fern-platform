import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { HeaderTabsList } from "@fern-docs/components/HeaderTabsList";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function HeaderTabsPage({
    params
}: {
    params: Promise<{ docsUrl: EncodedDocsUrl; slug: string; branch: string }>;
}) {
    const { docsUrl, slug, branch } = await params;
    const session = await getCurrentSession();
    const host = await getHostFromHeaders();
    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader({
        host,
        encodedDocsUrl: docsUrl,
        fernToken: session?.accessToken,
        branchName: branch
    });
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

    return <HeaderTabsList tabs={tabs} />;
}
