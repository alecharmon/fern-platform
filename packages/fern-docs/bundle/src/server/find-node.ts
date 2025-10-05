import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";

export function createFindNode(loader: DocsLoader) {
    return async (slug: FernNavigation.Slug) => {
        const root = await loader.getRoot();
        const node = FernNavigation.utils.findNode(root, slug);
        if (node.type === "found") {
            return node.node;
        }
        return undefined;
    };
}
