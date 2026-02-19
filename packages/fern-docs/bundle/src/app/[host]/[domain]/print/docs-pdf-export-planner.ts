import "server-only";

import type { ExportablePage, ExportableProduct, ExportableVersion } from "@fern-api/docs-pdf";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { getChildren, hasMetadata, isInternalProductNode } from "@fern-api/fdr-sdk/navigation";
import { assertNever } from "@fern-api/ui-core-utils";

export type ExportTocEntry =
    | {
          type: "group";
          key: string;
          title: string;
          children: ExportTocEntry[];
      }
    | {
          type: "page";
          key: string;
          title: string;
          slug: string;
          children: ExportTocEntry[];
      };

/**
 * Describes which product and version were resolved for exporting.
 */
export interface ExportSubtreeResolution {
    /**
     * The navigation node to use as the root for page collection and TOC rendering.
     * This is typically a VersionNode or UnversionedNode (or their child).
     */
    subtreeRoot: FernNavigation.NavigationNode;

    /**
     * The resolved product, if the docs site has multiple products.
     */
    resolvedProduct?: ExportableProduct;

    /**
     * The resolved version, if the docs site is versioned.
     */
    resolvedVersion?: ExportableVersion;

    /**
     * All available products (for informational / error messages).
     */
    availableProducts: ExportableProduct[];

    /**
     * All available versions within the resolved product (for informational / error messages).
     */
    availableVersions: ExportableVersion[];
}

/**
 * Error thrown when the requested product or version cannot be found.
 */
export class ExportSubtreeResolutionError extends Error {
    public readonly statusCode: number;
    public readonly details: Record<string, unknown>;

    constructor(message: string, statusCode: number, details: Record<string, unknown> = {}) {
        super(message);
        this.name = "ExportSubtreeResolutionError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

export class DocsPdfExportPlanner {
    /**
     * Resolve the navigation subtree to use for PDF export based on optional product/version parameters.
     *
     * The Fern navigation tree has three possible structures at the root level:
     *
     * 1. **ProductGroupNode** → multiple products, each with their own versioned/unversioned content
     * 2. **VersionedNode** → single product with multiple versions
     * 3. **UnversionedNode** → single product, single version
     *
     * This function navigates the tree to find the correct subtree for a given product/version combination.
     *
     * **Default behavior** (no params):
     * - For multi-product: uses the default product (or first internal product)
     * - For versioned: uses the default version (or first version)
     * - For unversioned: uses the unversioned content directly
     *
     * @throws {ExportSubtreeResolutionError} When the requested product or version is not found.
     */
    public resolveExportSubtree(
        root: FernNavigation.RootNode,
        params: { productId?: string; versionId?: string }
    ): ExportSubtreeResolution {
        const rootChild = root.child;

        switch (rootChild.type) {
            case "productgroup":
                return this.resolveExportSubtreeFromProductGroup(rootChild, params);
            case "versioned":
                return this.resolveExportSubtreeFromVersioned(rootChild, params);
            case "unversioned":
                return this.resolveExportSubtreeFromUnversioned(rootChild, params);
            default:
                assertNever(rootChild);
        }
    }

    /**
     * Resolve subtree from a ProductGroupNode (multi-product docs).
     */
    private resolveExportSubtreeFromProductGroup(
        productGroup: FernNavigation.ProductGroupNode,
        params: { productId?: string; versionId?: string }
    ): ExportSubtreeResolution {
        // Collect only internal products (external product links are not exportable)
        const internalProducts = productGroup.children.filter(isInternalProductNode);

        const availableProducts = internalProducts.map((p) => ({
            productId: String(p.productId),
            title: p.title,
            isDefault: p.default
        }));

        const [firstProduct] = internalProducts;

        if (firstProduct == null) {
            throw new ExportSubtreeResolutionError("No internal products found in product group", 404, {
                availableProducts: []
            });
        }

        let product;

        if (params.productId != null) {
            const found = internalProducts.find((p) => String(p.productId) === params.productId);
            if (!found) {
                throw new ExportSubtreeResolutionError(
                    `Product "${params.productId}" not found. Available products: ${availableProducts.map((p) => `"${p.productId}"`).join(", ")}`,
                    400,
                    { requestedProduct: params.productId, availableProducts }
                );
            }
            product = found;
        } else {
            product = internalProducts.find((p) => p.default) ?? firstProduct;
        }

        const resolvedProduct: ExportableProduct = {
            productId: product.productId,
            title: product.title,
            isDefault: product.default
        };

        const productChild = product.child;

        if (productChild.type === "versioned") {
            const versionResult = this.resolveVersionFromVersioned(productChild, params.versionId);
            return {
                subtreeRoot: versionResult.subtreeRoot,
                resolvedProduct,
                resolvedVersion: versionResult.resolvedVersion,
                availableProducts,
                availableVersions: versionResult.availableVersions
            };
        } else if (productChild.type === "unversioned") {
            if (params.versionId != null) {
                throw new ExportSubtreeResolutionError(
                    `Product "${resolvedProduct.productId}" is not versioned, but version "${params.versionId}" was requested`,
                    400,
                    { requestedVersion: params.versionId, resolvedProduct, availableVersions: [] }
                );
            }
            return {
                subtreeRoot: productChild,
                resolvedProduct,
                availableProducts,
                availableVersions: []
            };
        } else {
            assertNever(productChild);
        }
    }

    /**
     * Resolve subtree from a VersionedNode (single-product versioned docs).
     */
    private resolveExportSubtreeFromVersioned(
        versionedNode: FernNavigation.VersionedNode,
        params: { productId?: string; versionId?: string }
    ): ExportSubtreeResolution {
        if (params.productId != null) {
            throw new ExportSubtreeResolutionError(
                `This docs site does not have multiple products, but product "${params.productId}" was requested`,
                400,
                { requestedProduct: params.productId, availableProducts: [] }
            );
        }
        const versionResult = this.resolveVersionFromVersioned(versionedNode, params.versionId);
        return {
            subtreeRoot: versionResult.subtreeRoot,
            resolvedVersion: versionResult.resolvedVersion,
            availableProducts: [],
            availableVersions: versionResult.availableVersions
        };
    }

    /**
     * Resolve subtree from an UnversionedNode (single-product unversioned docs).
     */
    private resolveExportSubtreeFromUnversioned(
        unversionedNode: FernNavigation.UnversionedNode,
        params: { productId?: string; versionId?: string }
    ): ExportSubtreeResolution {
        if (params.productId != null) {
            throw new ExportSubtreeResolutionError(
                `This docs site does not have multiple products, but product "${params.productId}" was requested`,
                400,
                { requestedProduct: params.productId, availableProducts: [] }
            );
        }

        if (params.versionId != null) {
            throw new ExportSubtreeResolutionError(
                `This docs site is not versioned, but version "${params.versionId}" was requested`,
                400,
                { requestedVersion: params.versionId, availableVersions: [] }
            );
        }

        return {
            subtreeRoot: unversionedNode,
            resolvedProduct: undefined,
            resolvedVersion: undefined,
            availableProducts: [],
            availableVersions: []
        };
    }

    /**
     * Given a VersionedNode, find the target VersionNode based on the optional version parameter.
     */
    private resolveVersionFromVersioned(
        versionedNode: FernNavigation.VersionedNode,
        requestedVersion: string | undefined
    ): {
        subtreeRoot: FernNavigation.VersionNode;
        resolvedVersion: ExportableVersion;
        availableVersions: ExportableVersion[];
    } {
        const versions = versionedNode.children;

        const availableVersions = versions.map((v) => ({
            versionId: String(v.versionId),
            title: v.title,
            isDefault: v.default
        }));

        const [firstVersion] = versions;

        if (firstVersion == null) {
            throw new ExportSubtreeResolutionError("No versions found in versioned node", 404, {
                availableVersions: []
            });
        }

        let targetVersion: FernNavigation.VersionNode;

        if (requestedVersion != null) {
            const found = versions.find((v) => String(v.versionId) === requestedVersion);
            if (!found) {
                throw new ExportSubtreeResolutionError(
                    `Version "${requestedVersion}" not found. Available versions: ${availableVersions.map((v) => `"${v.versionId}"`).join(", ")}`,
                    400,
                    { requestedVersion, availableVersions }
                );
            }
            targetVersion = found;
        } else {
            targetVersion = versions.find((v) => v.default) ?? firstVersion;
        }

        return {
            subtreeRoot: targetVersion,
            resolvedVersion: {
                versionId: String(targetVersion.versionId),
                title: targetVersion.title,
                isDefault: targetVersion.default
            },
            availableVersions
        };
    }

    /**
     * Get the list of nodes to use as starting points for the TOC tree rendering.
     *
     * For version/unversioned nodes, we skip the wrapper and start from its children.
     * For other nodes with titles, we use the node itself.
     */
    public getTocStartNodes(subtreeRoot: FernNavigation.NavigationNode): readonly FernNavigation.NavigationNode[] {
        // Version and unversioned nodes are wrappers; start from their children
        if (subtreeRoot.type === "version" || subtreeRoot.type === "unversioned") {
            return getChildren(subtreeRoot).filter((child) => child.type !== "landingPage");
        }

        // If the node has metadata (title+slug), use it as the start node
        if (hasMetadata(subtreeRoot) && subtreeRoot.title) {
            return [subtreeRoot];
        }

        // Otherwise, unwrap and use children
        return getChildren(subtreeRoot);
    }

    /**
     * Build the TOC tree model for a given subtree.
     *
     * This model is already filtered to include only exportable pages (and any
     * ancestors needed to preserve grouping structure). Rendering code should
     * not need to apply additional "is printable?" checks.
     */
    public buildExportTocEntries(
        subtreeRoot: FernNavigation.NavigationNode,
        options: { includeAuthed?: boolean } = {}
    ): ExportTocEntry[] {
        const exportablePages = this.collectExportablePages(subtreeRoot, options);
        const exportableSlugSet = new Set(exportablePages.map((p) => p.slug));
        const tocStartNodes = this.getTocStartNodes(subtreeRoot);
        return tocStartNodes.flatMap((node) => this.buildExportTocEntriesFromNode(node, exportableSlugSet));
    }

    /**
     * Collect all PDF-exportable pages from a navigation subtree. This function traverses the
     * subtree depth-first and collects pages in order.
     */
    public collectExportablePages(
        subtreeRoot: FernNavigation.NavigationNode,
        options: { includeAuthed?: boolean } = {}
    ): ExportablePage[] {
        const pages: ExportablePage[] = [];

        FernNavigation.traverseDF(subtreeRoot, (node) => {
            if (
                !FernNavigation.isPage(node) ||
                node.hidden ||
                node.type === "changelog" ||
                node.type === "changelogEntry"
            ) {
                return;
            }

            if (!options.includeAuthed && node.authed) {
                return;
            }

            if (!FernNavigation.isApiLeaf(node)) {
                const pageId = FernNavigation.getPageId(node);
                if (pageId == null) {
                    return;
                }
            }

            pages.push({ slug: String(node.slug), title: node.title });
        });

        return pages;
    }

    private buildExportTocEntriesFromNode(
        node: FernNavigation.NavigationNode,
        exportableSlugSet: Set<string>
    ): ExportTocEntry[] {
        const childEntries = getChildren(node).flatMap((child) =>
            this.buildExportTocEntriesFromNode(child, exportableSlugSet)
        );

        const title = hasMetadata(node) ? node.title : undefined;
        const hasMeaningfulTitle = title != null && title.trim().length > 0;

        const isExportableLeaf =
            hasMetadata(node) && exportableSlugSet.has(String(node.slug)) && title != null && title.trim().length > 0;

        // If neither this node nor any of its descendants are exportable, omit it.
        if (!isExportableLeaf && childEntries.length === 0) {
            return [];
        }

        // Untitled wrappers: flatten without adding a new level.
        if (!hasMeaningfulTitle && !isExportableLeaf) {
            return childEntries;
        }

        const key = `${node.type}:${node.id}`;

        if (isExportableLeaf) {
            return [
                {
                    type: "page",
                    key,
                    title: title ?? "",
                    slug: hasMetadata(node) ? String(node.slug) : "",
                    children: childEntries
                }
            ];
        }

        return [
            {
                type: "group",
                key,
                title: title ?? "",
                children: childEntries
            }
        ];
    }
}
