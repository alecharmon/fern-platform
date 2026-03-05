import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getFallbackProduct, getFallbackVersion } from "@fern-api/docs-server";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { VersionDropdown } from "@fern-docs/components/header/VersionDropdown";

// ISR revalidation — keep in sync with sibling routes (see route-revalidate.ts)
export const revalidate = 60;

export default async function VersionSelectPage({
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

    const [layout, _auth, _flags, root, lang] = await Promise.all([
        loader.getLayout(),
        loader.getAuthState(),
        loader.getEdgeFlags(),
        loader.getRoot(),
        loader.getLanguage()
    ]);
    const useDenseLayout = layout.isHeaderDisabled || layout.switcherPlacement === "SIDEBAR";

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
            lang={lang}
        />
    );
}
