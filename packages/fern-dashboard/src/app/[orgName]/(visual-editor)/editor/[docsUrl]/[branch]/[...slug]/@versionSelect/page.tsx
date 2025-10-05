import "server-only";

import { createEditableDocsLoader } from "@fern-api/docs-loader";
import { getFallbackProduct, getFallbackVersion } from "@fern-api/docs-server/handle-node-fallbacks";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { VersionDropdown } from "@fern-docs/components/header/VersionDropdown";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function VersionSelectPage({
    params
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
        branchName: branch
    });

    // preload:
    const [layout, _auth, _flags, root] = await Promise.all([
        loader.getLayout(),
        loader.getAuthState(),
        loader.getEdgeFlags(),
        loader.getRoot()
    ]);
    const useDenseLayout = layout.isHeaderDisabled;

    const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));
    const collector = FernNavigation.NodeCollector.collect(root);
    const versionNodes = collector.getVersionNodes();

    if (versionNodes.length === 0) {
        return null;
    }

    const currentProduct = getFallbackProduct(foundNode, root, slug);
    const version = getFallbackVersion(foundNode, root, slug);

    if (version == null) {
        return null;
    }

    const currentNode = foundNode.type === "found" ? foundNode.node : version;

    const parents = foundNode.type === "found" ? Array.from(foundNode.parents) : [];

    return (
        <VersionDropdown
            loader={loader}
            currentNode={currentNode}
            currentProduct={currentProduct ?? undefined}
            slugMap={collector.slugMap}
            parents={parents}
            fallbackVersion={version}
            useDenseLayout={useDenseLayout}
        />
    );
}
