import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFallbackProduct } from "@fern-api/docs-server";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { ProductDropdown } from "@fern-docs/components/header/ProductDropdown";

export const revalidate = false;

export default async function ProductSelectPage({
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

    const [layout, _auth, _flags, root, theme] = await Promise.all([
        loader.getLayout(),
        loader.getAuthState(),
        loader.getEdgeFlags(),
        loader.getRoot(),
        loader.getTheme()
    ]);
    const useDenseLayout = layout.isHeaderDisabled || layout.switcherPlacement === "SIDEBAR";

    const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));

    const fallbackProduct = getFallbackProduct(foundNode, root, slug);
    if (fallbackProduct == null) {
        return null;
    }

    return (
        <ProductDropdown
            loader={loader}
            fallbackProduct={fallbackProduct}
            useDenseLayout={useDenseLayout}
            productSwitcherTheme={theme?.productSwitcher}
        />
    );
}
