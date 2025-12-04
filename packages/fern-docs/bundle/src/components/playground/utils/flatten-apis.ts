import * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { createBreadcrumbSlicer } from "./breadcrumb";

export interface ApiGroup {
    api: FernNavigation.ApiDefinitionId;
    id: FernNavigation.NodeId;
    breadcrumb: readonly string[];
    items: FernNavigation.NavigationNodeApiLeaf[];
}

const trimBreadcrumbs = createBreadcrumbSlicer<ApiGroup>({
    selectBreadcrumb: (apiGroup) => apiGroup.breadcrumb,
    updateBreadcrumb: (apiGroup, breadcrumb) => ({ ...apiGroup, breadcrumb })
});

export function flattenApiSection(root: FernNavigation.NavigationNode | undefined): ApiGroup[] {
    if (root == null) {
        return [];
    }
    const result: ApiGroup[] = [];
    FernNavigation.traverseDF(root, (node, parents) => {
        if (node.type === "changelog") {
            return "skip";
        }
        if (node.type === "apiReference" || node.type === "apiPackage") {
            // webhooks are not supported in the playground
            // Handle both regular API leaf nodes and endpointPair nodes (which contain stream/nonStream variants)
            const items: FernNavigation.NavigationNodeApiLeaf[] = [];
            for (const child of node.children) {
                if (child.type === "endpointPair") {
                    // Extract both endpoints from the pair
                    items.push(child.nonStream, child.stream);
                } else if (FernNavigation.isApiLeaf(child) && child.type !== "webhook") {
                    items.push(child);
                }
            }
            if (items.length === 0) {
                return;
            }

            // current node should be included in the breadcrumb
            const breadcrumb = FernNavigation.utils
                .createBreadcrumb([...parents, node])
                .map((breadcrumb) => breadcrumb.title);

            result.push({
                api: node.apiDefinitionId,
                id: node.id,
                breadcrumb,
                items
            });
        }
        return;
    });

    return trimBreadcrumbs(result);
}
