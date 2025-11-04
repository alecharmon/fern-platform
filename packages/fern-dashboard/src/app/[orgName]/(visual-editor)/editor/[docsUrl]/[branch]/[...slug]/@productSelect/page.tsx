import "server-only";

import { getFallbackProduct } from "@fern-api/docs-server/handle-node-fallbacks";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { ProductDropdown } from "@fern-docs/components/header/ProductDropdown";
import { getRootAliasAwareNavigationSlug } from "@fern-docs/components/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function ProductSelectPage({
    params
}: {
    params: Promise<{ docsUrl: EncodedDocsUrl; slug: string; branch: string }>;
}) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const { docsUrl, slug, branch } = await params;
    const host = await getHostFromHeaders();
    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader(host, docsUrl, session?.accessToken, branch);

    // preload:
    const [layout, root] = await Promise.all([loader.getLayout(), loader.getRoot()]);
    const useDenseLayout = layout.isHeaderDisabled;

    const navigationSlug = getRootAliasAwareNavigationSlug(slugjoin(slug), root);
    const foundNode = FernNavigation.utils.findNode(root, navigationSlug);

    const fallbackProduct = getFallbackProduct(foundNode, root, navigationSlug);
    if (fallbackProduct == null) {
        return null;
    }

    return <ProductDropdown loader={loader} fallbackProduct={fallbackProduct} useDenseLayout={useDenseLayout} />;
}
