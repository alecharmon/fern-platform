import { removeLeadingSlash, removeTrailingSlash } from "@fern-api/docs-utils";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { NodeCollector } from "@fern-api/fdr-sdk/navigation";

export function getSectionRoot(
    root: FernNavigation.RootNode | undefined,
    path: string
): FernNavigation.NavigationNodeWithMetadata | undefined {
    if (root == null) {
        return undefined;
    }

    const slug = removeLeadingSlash(removeTrailingSlash(path));

    if (path === "/" || root.slug === slug) {
        return root;
    }

    const collector = NodeCollector.collect(root);
    return collector.slugMap.get(slug);
}
