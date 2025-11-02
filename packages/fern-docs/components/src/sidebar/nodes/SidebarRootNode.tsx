import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import Image from "next/image";

import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarRootNodeImpl } from "./SidebarRootNodeImpl";

/**
 * Recursively collects all VariantNodes from the sidebar tree
 */
function collectVariantNodesFromRoot(root: FernNavigation.SidebarRootNode): FernNavigation.VariantNode[] {
    const variants: FernNavigation.VariantNode[] = [];

    function processChild(child: FernNavigation.SidebarRootChild | FernNavigation.NavigationChild): void {
        if (child.type === "varianted") {
            // Add all variant children
            variants.push(...child.children);
            // Also recursively check children of each variant for nested varianted nodes
            child.children.forEach((variant) => {
                variant.children.forEach((variantChild) => {
                    processChild(variantChild as FernNavigation.NavigationChild);
                });
            });
        } else if (child.type === "sidebarGroup") {
            child.children.forEach((groupChild) => {
                processChild(groupChild);
            });
        } else if (child.type === "section") {
            child.children.forEach((sectionChild) => {
                processChild(sectionChild);
            });
        } else if (child.type === "apiReference") {
            child.children.forEach((apiChild) => {
                if (apiChild.type === "apiPackage" && "children" in apiChild) {
                    apiChild.children.forEach((packageChild) => {
                        processChild(packageChild as FernNavigation.NavigationChild);
                    });
                }
            });
        }
    }

    root.children.forEach((child) => {
        processChild(child);
    });

    return variants;
}

export async function SidebarRootNode({
    root,
    visibleNodeIds,
    loader,
    renderOptions
}: {
    root: FernNavigation.SidebarRootNode | undefined;
    visibleNodeIds: FernNavigation.NodeId[] | undefined;
    loader: DocsLoader;
    renderOptions?: SidebarRenderOptions;
}) {
    const authState = await loader.getAuthState();
    const edgeFlags = await loader.getEdgeFlags();

    // Resolve variant images on the server and get files for icons
    let variantImages: Record<FernNavigation.VariantId, React.ReactNode> = {};
    if (root && renderOptions?.files) {
        const resolveFileSrc = createFileResolver(renderOptions?.files);

        // Collect all variant nodes from the sidebar tree
        const allVariants = collectVariantNodesFromRoot(root);

        // Resolve each variant's image
        variantImages = Object.fromEntries(
            allVariants
                .filter((variant) => variant.image != null)
                .map((variant) => {
                    const resolvedImage = resolveFileSrc(variant.image);
                    const imageNode = resolvedImage ? (
                        <Image
                            key={`variant-img-${variant.variantId}`}
                            src={resolvedImage.src}
                            alt={variant.title}
                            width={resolvedImage.width || 36}
                            height={resolvedImage.height || 36}
                            className="h-full w-full rounded object-cover"
                        />
                    ) : undefined;
                    return [variant.variantId, imageNode];
                })
                .filter(([, imageNode]) => imageNode != null)
        );
    }

    return (
        <SidebarRootNodeImpl
            root={root}
            visibleNodeIds={visibleNodeIds}
            authState={authState}
            edgeFlags={edgeFlags}
            renderOptions={{
                ...renderOptions,
                variantImages,
                files: renderOptions?.files
            }}
        />
    );
}
