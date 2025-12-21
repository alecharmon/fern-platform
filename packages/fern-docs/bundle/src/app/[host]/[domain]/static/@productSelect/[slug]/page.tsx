import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFallbackProduct } from "@fern-api/docs-server";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { ProductDropdown } from "@fern-docs/components/header/ProductDropdown";

import { getFernToken } from "@/app/fern-token";

export const revalidate = false;

export default async function ProductSelectPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());

    const [layout, _auth, _flags, root, theme] = await Promise.all([
        loader.getLayout(),
        loader.getAuthState(),
        loader.getEdgeFlags(),
        loader.getRoot(),
        loader.getTheme()
    ]);
    const useDenseLayout = layout.isHeaderDisabled;

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
