import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { withPrunedNavigation } from "@fern-api/docs-server/withPrunedNavigation";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";

import { getFernToken } from "@/app/fern-token";
import { PlaygroundEndpointSelectorContent } from "@/components/playground/endpoint/PlaygroundEndpointSelectorContent";
import { flattenApiSection } from "@/components/playground/utils/flatten-apis";

export default async function EndpointSelectorPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;

    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const root = await loader.getRoot();
    const lang = await loader.getLanguage();

    const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));
    if (foundNode.type !== "found") {
        return null;
    }

    const visibleNodes = [...foundNode.parents, foundNode.node];
    const visibleNodeIds = visibleNodes.map((node) => node.id);

    const filtered = withPrunedNavigation(root, {
        visibleNodeIds: visibleNodeIds,
        authed: (await loader.getAuthState()).authed,
        // when true, all unauthed pages are visible, but rendered with a LOCK button
        // so they're not actually "pruned" from the sidebar
        // TODO: move this out of a feature flag and into the navigation node metadata
        discoverable: (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable ? (true as const) : undefined
    });

    if (!filtered) {
        return null;
    }

    let scopedNode: FernNavigation.NavigationNode | undefined = filtered;

    if (foundNode.currentProduct) {
        FernNavigation.traverseDF(filtered, (node) => {
            if (node.type === "product" && node.productId === foundNode.currentProduct?.productId) {
                scopedNode = node;
                return false;
            }
        });
    }

    if (foundNode.currentVersion) {
        FernNavigation.traverseDF(scopedNode, (node) => {
            if (node.type === "version" && node.versionId === foundNode.currentVersion?.versionId) {
                scopedNode = node;
                return false;
            }
        });
    }

    const apiGroups = flattenApiSection(scopedNode);

    return <PlaygroundEndpointSelectorContent apiGroups={apiGroups} className="h-full" lang={lang} />;
}
