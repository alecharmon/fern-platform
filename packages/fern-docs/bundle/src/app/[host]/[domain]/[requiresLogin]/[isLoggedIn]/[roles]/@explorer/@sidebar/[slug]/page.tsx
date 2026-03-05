import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { withPrunedNavigation } from "@fern-api/docs-server/withPrunedNavigation";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";

import { PlaygroundEndpointSelectorContent } from "@/components/playground/endpoint/PlaygroundEndpointSelectorContent";
import { flattenApiSection } from "@/components/playground/utils/flatten-apis";

export const revalidate = false;

export default async function EndpointSelectorPage({
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
    const root = await loader.getRoot();
    const lang = await loader.getLanguage();

    const foundNode = FernNavigation.utils.findNode(root, slugjoin(slug));

    let targetNode: FernNavigation.utils.Node | undefined = foundNode;
    if (foundNode.type !== "found") {
        if (foundNode.redirect != null) {
            const redirectNode = FernNavigation.utils.findNode(root, foundNode.redirect);
            if (redirectNode.type === "found") {
                targetNode = redirectNode;
            }
        }

        if (targetNode?.type !== "found") {
            let firstApiNode: FernNavigation.NavigationNodePage | undefined;
            FernNavigation.traverseDF(root, (node) => {
                if (FernNavigation.isApiLeaf(node)) {
                    firstApiNode = node;
                    return false;
                }
                return true;
            });

            if (firstApiNode != null) {
                const found = FernNavigation.utils.findNode(root, firstApiNode.slug);
                if (found.type === "found") {
                    targetNode = found;
                }
            }
        }
    }

    if (targetNode?.type !== "found") {
        return null;
    }

    const visibleNodes = [...targetNode.parents, targetNode.node];
    const visibleNodeIds = visibleNodes.map((node) => node.id);

    const filtered = withPrunedNavigation(root, {
        visibleNodeIds: visibleNodeIds,
        authed: (await loader.getAuthState()).authed,
        discoverable: (await loader.getEdgeFlags()).isAuthenticatedPagesDiscoverable ? (true as const) : undefined
    });

    if (!filtered) {
        return null;
    }

    let scopedNode: FernNavigation.NavigationNode | undefined = filtered;

    if (targetNode.currentProduct) {
        FernNavigation.traverseDF(filtered, (node) => {
            if (node.type === "product" && node.productId === targetNode.currentProduct?.productId) {
                scopedNode = node;
                return false;
            }
            return true;
        });
    }

    if (targetNode.currentVersion) {
        FernNavigation.traverseDF(scopedNode, (node) => {
            if (node.type === "version" && node.versionId === targetNode.currentVersion?.versionId) {
                scopedNode = node;
                return false;
            }
            return true;
        });
    }

    const apiGroups = flattenApiSection(scopedNode);

    return <PlaygroundEndpointSelectorContent apiGroups={apiGroups} className="h-full" shallow replace lang={lang} />;
}
