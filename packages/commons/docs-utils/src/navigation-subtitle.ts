import type { FernNavigation } from "@fern-api/fdr-sdk";

/**
 * Generate a breadcrumb-style subtitle from parent navigation nodes
 */
export function generateNavigationSubtitle(
    node: FernNavigation.NavigationNodeWithMetadata,
    slugMapWithParents: ReturnType<FernNavigation.NodeCollector["getSlugMapWithParents"]>
): string | undefined {
    const entry = slugMapWithParents.get(node.slug);
    if (!entry?.parents || entry.parents.length === 0) {
        // If it's a product node, use its subtitle
        if (node.type === "product" && "subtitle" in node) {
            return node.subtitle;
        }
        return undefined;
    }

    // Build breadcrumb from parents, excluding root
    const breadcrumbParts = entry.parents
        .filter((parent) => parent.type !== "root" && parent.type !== "sidebarRoot")
        .map((parent) => ("title" in parent ? parent.title : undefined))
        .filter((title): title is string => title != null && title.length > 0);

    return breadcrumbParts.length > 0 ? breadcrumbParts.join(" › ") : undefined;
}
