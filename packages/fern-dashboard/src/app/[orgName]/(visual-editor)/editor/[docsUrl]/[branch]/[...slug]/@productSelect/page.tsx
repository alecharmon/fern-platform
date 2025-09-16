import "server-only";

import { createEditableDocsLoader } from "@fern-api/docs-loader";
import { getFallbackProduct } from "@fern-api/docs-server/handle-node-fallbacks";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { ProductDropdown } from "@fern-docs/components/header/ProductDropdown";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { EncodedDocsUrl } from "@/utils/types";

export default async function ProductSelectPage({
  params,
}: {
  params: Promise<{ docsUrl: EncodedDocsUrl; slug: string; branch: string }>;
}) {
  const session = await getCurrentSession();
  const { docsUrl, slug, branch } = await params;
  const host = await getHostFromHeaders();
  const loader = await createEditableDocsLoader({
    host,
    encodedDocsUrl: docsUrl,
    fernToken: session?.accessToken,
    branchName: branch,
  });

  // preload:
  const [layout, _auth, _flags, root] = await Promise.all([
    loader.getLayout(),
    loader.getAuthState(),
    loader.getEdgeFlags(),
    loader.getRoot(),
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
    />
  );
}
