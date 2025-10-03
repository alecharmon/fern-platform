import { FernNavigation } from "@fern-api/fdr-sdk";
import {
    RoleId,
    isProductGroupNode,
    isProductNode,
    isTabbedNode,
    isUnversionedNode,
    isVersionNode,
    slugjoin
} from "@fern-api/fdr-sdk/navigation";

export const getFallbackProduct = (
    foundNode: FernNavigation.utils.Node,
    root: FernNavigation.RootNode,
    slug: string
): FernNavigation.ProductNode | null => {
    // 1. If the node is found, we use the parents to find the current product
    if (foundNode.type === "found") {
        const product = foundNode.parents.find(isProductNode);
        if (product) {
            return product;
        }
    }

    // 2. Try to find a matching product based on the slug
    const collector = FernNavigation.NodeCollector.collect(root);
    const productNodes = collector.getProductNodes();

    const productWithMatchingSlug = productNodes.find(
        (p) => slugjoin(slug).startsWith(slugjoin(p.slug) + "/") // add a trailing slash to ensure exact match (e.g. /docssss/1 should not match /docs/)
    );
    if (productWithMatchingSlug) {
        return productWithMatchingSlug;
    }

    // 3. If the root node has a product group, we can use the children to find a default product
    if (isProductGroupNode(root.child)) {
        const product = root.child.children.find(isProductNode);
        if (product) {
            return product;
        }
    }
    return null;
};

export const getFallbackVersion = (
    foundNode: FernNavigation.utils.Node,
    root: FernNavigation.RootNode,
    slug: string
): FernNavigation.VersionNode | null => {
    // 1. If the node is found, we can use the parents to find the current version
    if (foundNode.type === "found") {
        const version = foundNode.parents.find(isVersionNode);
        if (version) {
            return version;
        }
    }

    // 2. Find the matching version or default version for the fallback product, if one exists
    const fallbackProduct = getFallbackProduct(foundNode, root, slug);
    if (fallbackProduct) {
        if (fallbackProduct.child.type === "versioned") {
            const versionWithMatchingSlug = fallbackProduct.child.children.find((p) =>
                slugjoin(slug).startsWith(slugjoin(p.slug))
            );
            if (versionWithMatchingSlug) {
                return versionWithMatchingSlug;
            }
            return fallbackProduct.child.children.find(isVersionNode) ?? null;
        } else {
            return null;
        }
    }

    // 3.Try to find a matching version based on the slug
    const collector = FernNavigation.NodeCollector.collect(root);
    const versionNodes = collector.getVersionNodes();
    const versionWithMatchingSlug = versionNodes.find((p) => slugjoin(slug).startsWith(slugjoin(p.slug)));
    if (versionWithMatchingSlug) {
        return versionWithMatchingSlug;
    }

    return null;
};

const getTabsInternal = (
    foundNode: FernNavigation.utils.Node,
    root: FernNavigation.RootNode,
    slug: string
): FernNavigation.TabChild[] | null => {
    if (foundNode.type === "found" && foundNode.tabs) {
        return Array.from(foundNode.tabs);
    }

    // If not found, check if there exist tabs we should show on the 404 page
    if (foundNode.type !== "found") {
        // Check if the root has tabs
        if (isUnversionedNode(root.child) && isTabbedNode(root.child.child)) {
            const tabs = root.child.child.children;
            if (tabs.length > 0) {
                return tabs;
            }
        }
        const product = getFallbackProduct(foundNode, root, slug);
        const version = getFallbackVersion(foundNode, root, slug);

        if (product) {
            switch (product.child.type) {
                case "unversioned":
                    if (isTabbedNode(product.child.child)) {
                        return product.child.child.children;
                    }
                    return null;
                case "versioned":
                    if (version) {
                        return isTabbedNode(version.child) ? version.child.children : null;
                    }
                    return null;
                default:
                    return null;
            }
        } else if (version) {
            return isTabbedNode(version.child) ? version.child.children : null;
        }
    }
    return null;
};

export const getTabs = (
    foundNode: FernNavigation.utils.Node,
    root: FernNavigation.RootNode,
    slug: string,
    showHiddenNodes: boolean,
    roles: string[]
): FernNavigation.TabChild[] | null => {
    const tabs = getTabsInternal(foundNode, root, slug);

    if (showHiddenNodes) {
        return tabs;
    }

    return (
        tabs?.filter((tab) => {
            if (tab.type !== "tab" && tab.type !== "changelog") {
                return true; // link type
            }

            if (tab.authed) {
                return false;
            }

            if (!tab.viewers || tab.viewers.length === 0 || tab.viewers.includes(RoleId("everyone"))) {
                return true;
            }

            return tab.viewers.some((viewerRole: RoleId) => roles.includes(viewerRole as string));
        }) ?? null
    );
};

export const getProducts = (
    root: FernNavigation.RootNode,
    showHiddenNodes: boolean,
    roles: string[]
): FernNavigation.ProductNode[] | null => {
    if (root.child.type !== "productgroup") {
        return null;
    }

    const products = root.child.children;

    if (showHiddenNodes) {
        return products;
    }

    return (
        products?.filter((product) => {
            if (product.type !== "product") {
                return true;
            }

            if (product.authed) {
                return false;
            }

            if (!product.viewers || product.viewers.length === 0 || product.viewers.includes(RoleId("everyone"))) {
                return true;
            }

            return product.viewers.some((viewerRole: RoleId) => roles.includes(viewerRole as string));
        }) ?? null
    );
};
