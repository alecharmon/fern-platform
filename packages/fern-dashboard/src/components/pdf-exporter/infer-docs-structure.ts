import type { ExportableProduct, ExportableVersion } from "@fern-api/docs-pdf";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

/**
 * Describes the high-level structure of a Fern docs site for the PDF export UI.
 * Passed as serializable props from a server component so the client never needs
 * to fetch scope separately.
 */
export type DocsStructure =
    | { type: "unversioned" }
    | { type: "versioned"; versions: ExportableVersion[] }
    | {
          type: "multiProduct";
          products: ExportableProduct[];
          versionsByProduct: Record<string, ExportableVersion[]>;
      };

function extractVersions(versionedNode: FernNavigation.VersionedNode): ExportableVersion[] {
    return versionedNode.children.map((v) => ({
        versionId: String(v.versionId),
        title: v.title,
        isDefault: v.default
    }));
}

export function inferDocsStructure(root: FernNavigation.RootNode): DocsStructure {
    const rootChild = root.child;

    switch (rootChild.type) {
        case "productgroup": {
            const products: ExportableProduct[] = [];
            const versionsByProduct: Record<string, ExportableVersion[]> = {};

            for (const productNode of rootChild.children) {
                if (productNode.type !== "product") {
                    continue;
                }

                const productId = String(productNode.productId);
                products.push({
                    productId,
                    title: productNode.title,
                    isDefault: productNode.default
                });

                if (productNode.child.type === "versioned") {
                    versionsByProduct[productId] = extractVersions(productNode.child);
                } else {
                    versionsByProduct[productId] = [];
                }
            }

            return { type: "multiProduct", products, versionsByProduct };
        }

        case "versioned":
            return { type: "versioned", versions: extractVersions(rootChild) };

        case "unversioned":
            return { type: "unversioned" };
    }
}
