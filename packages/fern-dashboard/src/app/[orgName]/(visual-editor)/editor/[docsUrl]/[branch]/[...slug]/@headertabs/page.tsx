import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { HeaderTabsList } from "@fern-docs/components/HeaderTabsList";
import { getRootAliasAwareNavigationSlug } from "@fern-docs/components/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function HeaderTabsPage({
    params
}: {
    params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl; slug: string; branch: string }>;
}) {
    const { orgName, docsUrl, slug, branch } = await params;
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const host = await getHostFromHeaders();
    const { githubUrl } = await assertAuthAndFetchGithubUrl({
        orgName,
        docsUrl: parseDocsUrlParam({ docsUrl })
    });
    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader(host, docsUrl, session.accessToken, branch);
    const layout = await loader.getLayout();

    if (layout.tabsPlacement !== "HEADER") {
        return null;
    }

    const root = await loader.getRoot();

    const authState = await loader.getAuthState();

    const showAuthenticatedNodes = (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable;

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

    return <HeaderTabsList tabs={tabs} />;
}
