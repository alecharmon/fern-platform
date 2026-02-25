import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { createFileResolver } from "@fern-api/docs-server/file-resolver";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import Image from "next/image";

import { processIconServer } from "../../processIconServer";
import { InitialNodeIdProvider } from "../../state/navigation";
import type { SidebarRenderOptions } from "../SidebarRenderOptions";
import { SidebarRootNodeImpl } from "./SidebarRootNodeImpl";

/**
 * Recursively collects all nodes that have icons from the sidebar tree
 */
function collectAllNodesWithIcons(root: FernNavigation.SidebarRootNode): FernNavigation.NavigationNode[] {
    const nodesWithIcons: FernNavigation.NavigationNode[] = [];

    function processChild(
        child: FernNavigation.SidebarRootChild | FernNavigation.NavigationChild | FernNavigation.ApiPackageChild
    ): void {
        // Check if this node has an icon
        if ("icon" in child && child.icon) {
            nodesWithIcons.push(child as FernNavigation.NavigationNode);
        }

        // Recursively process children
        if (child.type === "sidebarGroup") {
            child.children.forEach(processChild);
        } else if (child.type === "section") {
            child.children.forEach(processChild);
        } else if (child.type === "apiReference" || child.type === "apiPackage") {
            child.children.forEach(processChild);
            if (child.type === "apiReference" && child.changelog) {
                processChild(child.changelog);
            }
        } else if (child.type === "varianted") {
            child.children.forEach((variant) => {
                if (variant.icon) {
                    nodesWithIcons.push(variant);
                }
                variant.children.forEach((variantChild) => {
                    processChild(variantChild as FernNavigation.NavigationChild);
                });
            });
        }
    }

    root.children.forEach((child) => {
        processChild(child);
    });

    return nodesWithIcons;
}

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
    renderOptions,
    lang,
    initialNodeId
}: {
    root: FernNavigation.SidebarRootNode | undefined;
    visibleNodeIds: FernNavigation.NodeId[] | undefined;
    loader: DocsLoader;
    renderOptions?: SidebarRenderOptions;
    lang: string;
    initialNodeId?: FernNavigation.NodeId;
}) {
    const authState = await loader.getAuthState();
    const edgeFlags = await loader.getEdgeFlags();

    // Resolve variant images and icons on the server
    let variantImages: Record<FernNavigation.VariantId, React.ReactNode> = {};
    let preResolvedIcons: Record<FernNavigation.NodeId, React.ReactNode> = {};

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

        // Collect all nodes with icons and pre-resolve them server-side
        const nodesWithIcons = collectAllNodesWithIcons(root);

        // Resolve all icons in parallel
        const iconPromises = nodesWithIcons.map(async (node) => {
            const icon = await processIconServer({ node, files: renderOptions.files });
            return [node.id, icon] as const;
        });

        const resolvedIcons = await Promise.all(iconPromises);
        preResolvedIcons = Object.fromEntries(resolvedIcons.filter(([, icon]) => icon != null));
    }

    return (
        <InitialNodeIdProvider initialNodeId={initialNodeId}>
            <SidebarRootNodeImpl
                root={root}
                visibleNodeIds={visibleNodeIds}
                authState={authState}
                edgeFlags={edgeFlags}
                renderOptions={{
                    ...renderOptions,
                    variantImages,
                    preResolvedIcons,
                    files: renderOptions?.files
                }}
                lang={lang}
            />
        </InitialNodeIdProvider>
    );
}
