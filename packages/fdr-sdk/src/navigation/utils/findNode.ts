import { escapeRegExp } from "es-toolkit/string";

import { FernNavigation } from "../..";
import { NodeCollector } from "../NodeCollector";
import { isApiReferenceNode } from "../versions/latest/isApiReferenceNode";
import { isProductGroupNode } from "../versions/latest/isProductGroupNode";
import { isProductNode } from "../versions/latest/isProductNode";
import { isSidebarRootNode } from "../versions/latest/isSidebarRootNode";
import { isTabbedNode } from "../versions/latest/isTabbedNode";
import { isUnversionedNode } from "../versions/latest/isUnversionedNode";
import { isVariantNode } from "../versions/latest/isVariantNode";
import { isVersionNode } from "../versions/latest/isVersionNode";
import { createBreadcrumb } from "./createBreadcrumb";

export type Node = Node.Found | Node.Redirect | Node.NotFound;

export declare namespace Node {
    interface Found {
        type: "found";
        node: FernNavigation.NavigationNodePage;
        parents: readonly FernNavigation.NavigationNodeParent[];
        breadcrumb: readonly FernNavigation.BreadcrumbItem[];
        root: FernNavigation.RootNode;
        products: readonly FernNavigation.ProductNode[];
        currentProduct: FernNavigation.ProductNode | undefined;
        /**
         * This is true if the current product is the default product node (without the product slug prefix)
         */
        isCurrentProductDefault: boolean;
        versions: readonly FernNavigation.VersionNode[];
        currentVersion: FernNavigation.VersionNode | undefined;
        /**
         * This is true if the current version is the default version node (without the version slug prefix)
         */
        isCurrentVersionDefault: boolean;
        variants: readonly FernNavigation.VariantNode[];
        currentVariant: FernNavigation.VariantNode | undefined;
        /**
         * This is true if the current variant is the default variant node (without the variant slug prefix)
         */
        isCurrentVariantDefault: boolean;
        currentTab: FernNavigation.TabNode | FernNavigation.ChangelogNode | undefined;
        tabs: readonly FernNavigation.TabChild[];
        sidebar: FernNavigation.SidebarRootNode | undefined;
        apiReference: FernNavigation.ApiReferenceNode | undefined;
        next: FernNavigation.NavigationNodeNeighbor | undefined;
        prev: FernNavigation.NavigationNodeNeighbor | undefined;
        collector: NodeCollector;
        landingPage: FernNavigation.LandingPageNode | undefined;

        /**
         * This is the part of the slug after the version (or basepath) prefix.
         *
         * For example, if the original slug is "docs/v1.0.0/foo/bar", the unversionedSlug is "foo/bar".
         */
        unversionedSlug: FernNavigation.Slug;
    }

    interface Redirect {
        type: "redirect";
        redirect: FernNavigation.Slug;
    }

    interface NotFound {
        type: "notFound";
        redirect: FernNavigation.Slug | undefined;
        authed: boolean | undefined;
    }
}

export function findNode(root: FernNavigation.RootNode, slug: FernNavigation.Slug): Node {
    const collector = NodeCollector.collect(root);
    const found = collector.getSlugMapWithParents().get(slug);

    // if the slug points to a node that doesn't exist, we should redirect to the first likely node
    if (found == null) {
        let maybeProductOrVersionNode:
            | FernNavigation.RootNode
            | FernNavigation.ProductNode
            | FernNavigation.VersionNode = root;
        let foundProductNode = false;

        // the 404 behavior should be product-aware
        for (const productNode of collector.getProductNodes()) {
            // External product links don't have slugs, so skip them
            if (productNode.type === "product" && slug.startsWith(productNode.slug)) {
                maybeProductOrVersionNode = productNode;
                foundProductNode = true;
                break;
            }
        }

        // if we didn't find a product node, try to find a version node
        if (!foundProductNode) {
            // the 404 behavior should be version-aware
            for (const versionNode of collector.getVersionNodes()) {
                if (slug.startsWith(versionNode.slug)) {
                    maybeProductOrVersionNode = versionNode;
                    break;
                }
            }
        }

        // if we still haven't found a matching product or version, check if the slug matches
        // the productgroup's landing page (only if no product matched to avoid collisions)
        if (!foundProductNode && isProductGroupNode(root.child) && root.child.landingPage != null) {
            const landingPageSlug = root.child.landingPage.slug;
            if (slug === landingPageSlug) {
                return { type: "redirect", redirect: landingPageSlug };
            }
        }

        return {
            type: "notFound",
            // External product links don't have pointsTo, only internal products and versions do
            redirect:
                maybeProductOrVersionNode.type === "root" ||
                maybeProductOrVersionNode.type === "product" ||
                maybeProductOrVersionNode.type === "version"
                    ? maybeProductOrVersionNode.pointsTo
                    : undefined,
            authed: maybeProductOrVersionNode.authed
        };
    }

    let sidebar = found.parents.find(isSidebarRootNode);
    const currentProductGroup = found.parents.find(isProductGroupNode);
    const currentProduct = found.parents.find(isProductNode);

    const currentVersion = found.parents.find(isVersionNode);
    const unversionedNode = found.parents.find(isUnversionedNode);
    const versionChild = (currentVersion ?? unversionedNode)?.child;

    const currentVariant = found.parents.find(isVariantNode);

    if (!sidebar && currentVersion != null) {
        if (isSidebarRootNode(currentVersion.child)) {
            sidebar = currentVersion.child;
        }
    }

    const landingPage = (currentProductGroup ?? currentVersion ?? unversionedNode)?.landingPage;

    const tabbedNode =
        found.parents.find(isTabbedNode) ??
        // fallback to the version child because the current node may be a landing page
        (versionChild != null && isTabbedNode(versionChild) ? versionChild : undefined);

    const apiReference =
        found.parents.find(isApiReferenceNode) ?? (found.node.type === "apiReference" ? found.node : undefined);

    // if the node is visible (because it's a page), return it as "found"
    if (FernNavigation.isPage(found.node)) {
        const parentsAndNode = [...found.parents, found.node];
        const tabbedNodeIndex = parentsAndNode.findIndex((node) => node === tabbedNode);
        const currentTabNode = tabbedNodeIndex !== -1 ? parentsAndNode[tabbedNodeIndex + 1] : undefined;

        const products = collector.getProductNodes().map((node) => {
            if (node.default) {
                // if we're currently viewing the default product, we may be viewing the non-pruned product node
                if (node.id === currentProduct?.id) {
                    return currentProduct;
                }
                // otherwise, we should always use the pruned product node
                return collector.defaultProductNode ?? node;
            }
            return node;
        });

        const versions = collector.getVersionNodes().map((node) => {
            if (node.default) {
                // if we're currently viewing the default version, we may be viewing the non-pruned version
                if (node.id === currentVersion?.id) {
                    return currentVersion;
                }
                // otherwise, we should always use the pruned version node
                return collector.defaultVersionNode ?? node;
            }
            return node;
        });

        const variants = collector.getVariantNodes().map((node) => {
            if (node.default) {
                // if we're currently viewing the default variant, we may be viewing the non-pruned variant
                if (node.id === currentVariant?.id) {
                    return currentVariant;
                }
                // otherwise, we should always use the pruned variant node
                return collector.defaultVariantNode ?? node;
            }
            return node;
        });

        let currentTab: FernNavigation.TabNode | FernNavigation.ChangelogNode | undefined =
            currentTabNode?.type === "tab" || currentTabNode?.type === "changelog" ? currentTabNode : undefined;

        // If currentTab is undefined and we have tabs, try to find the appropriate tab
        if (currentTab == null && tabbedNode != null) {
            // First, check if any tab's pointsTo matches the current page's slug
            for (const tab of tabbedNode.children) {
                if (tab.type === "tab" && tab.pointsTo === found.node.slug) {
                    currentTab = tab;
                    break;
                }
                if (tab.type === "changelog" && tab.slug === found.node.slug) {
                    currentTab = tab;
                    break;
                }
            }

            // If still no tab found and we're on a landing page, select the first tab
            if (currentTab == null && found.node.type === "landingPage") {
                const firstTab = tabbedNode.children.find((tab) => tab.type === "tab" || tab.type === "changelog");
                if (firstTab != null && (firstTab.type === "tab" || firstTab.type === "changelog")) {
                    currentTab = firstTab;
                }
            }
        }
        // External product links don't have slugs, so fall back to version or root slug
        const slugPrefix =
            currentVariant?.slug ??
            (currentProduct?.type === "product" ? currentProduct.slug : undefined) ??
            currentVersion?.slug ??
            root.slug;
        const unversionedSlug = FernNavigation.Slug(
            found.node.slug.replace(new RegExp(`^${escapeRegExp(slugPrefix)}/`), "")
        );
        return {
            type: "found",
            node: found.node,
            breadcrumb: createBreadcrumb(found.parents),
            parents: found.parents,
            root,
            versions, // this is used to render the version switcher
            tabs: tabbedNode?.children ?? [],
            products,
            currentProduct,
            currentVersion,
            isCurrentProductDefault: currentProduct?.default ? currentProduct === collector.defaultProductNode : false,
            isCurrentVersionDefault: currentVersion?.default ? currentVersion === collector.defaultVersionNode : false,
            variants, // this is used to render the variant switcher
            currentVariant,
            isCurrentVariantDefault: currentVariant?.default ? currentVariant === collector.defaultVariantNode : false,
            currentTab,
            sidebar,
            apiReference,
            landingPage,
            next: found.next,
            prev: found.prev,
            collector,
            unversionedSlug
        };
    }

    // if the slug points matches the root node, redirect to the root node's pointsTo
    if (root.type === "root" && root.slug === slug && root.pointsTo != null) {
        return { type: "redirect", redirect: root.pointsTo };
    }

    // if the node has a redirect, return it
    if (FernNavigation.hasRedirect(found.node) && found.node.pointsTo != null) {
        return { type: "redirect", redirect: found.node.pointsTo };
    }

    // Special handling for variant nodes without pointsTo - find the first page in their children
    if (found.node.type === "variant" && (found.node.pointsTo == null || found.node.pointsTo === undefined)) {
        const firstPage = findFirstPageInNode(found.node);
        if (firstPage != null) {
            return { type: "redirect", redirect: firstPage };
        }
    }

    // if the node does not have a redirect, return a 404
    return {
        type: "notFound",
        redirect: currentVersion?.pointsTo ?? root.pointsTo,
        authed: found.node.authed
    };
}

/**
 * Recursively searches for the first page node within a given node's children
 */
function findFirstPageInNode(node: FernNavigation.NavigationNode): FernNavigation.Slug | undefined {
    if (FernNavigation.isPage(node)) {
        return (node as any).slug;
    }

    const children = FernNavigation.getChildren(node);
    if (children == null) {
        return undefined;
    }

    for (const child of children) {
        const firstPage = findFirstPageInNode(child);
        if (firstPage != null) {
            return firstPage;
        }
    }

    return undefined;
}
