import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { withVersionSwitcherInfo } from "@fern-api/docs-server/withVersionSwitcherInfo";
import { FernNavigation } from "@fern-api/fdr-sdk";

import { FaIconServer } from "../fa-icon-server";
import { VersionDropdownClient, type VersionDropdownItem } from "./VersionDropdownClient";

export declare namespace VersionDropdown {
    export interface Props {}
}

/**
 * The version dropdown is used to switch between versions at a root level or at a product level.
 *
 * The version dropdown is used at a root level if the root is versioned.
 * The version dropdown is used at a product level if the root has a productgroup and the current product is versioned.
 */
export async function VersionDropdown({
    loader,
    currentNode,
    currentProduct,
    slugMap,
    parents,
    fallbackVersion,
    useDenseLayout = false
}: {
    loader: DocsLoader;
    slugMap: Map<string, FernNavigation.NavigationNodeWithMetadata>;
    currentProduct: FernNavigation.ProductNode | undefined;
    currentNode: FernNavigation.NavigationNodeWithMetadata;
    parents: FernNavigation.NavigationNodeParent[];
    fallbackVersion: FernNavigation.VersionNode;
    useDenseLayout?: boolean;
}) {
    const root = await loader.getRoot();
    // HACK: force the version dropdown to appear in the cohere theme
    const isCohere = loader.domain.includes("cohere");

    // If the root is not versioned or a productgroup, don't render the version dropdown
    if (root.child.type !== "versioned" && root.child.type !== "productgroup") {
        return null;
    }

    let versions: FernNavigation.VersionNode[] = [];
    // let currentProduct: FernNavigation.ProductNode | undefined;

    // Handle case where root is a productgroup and the current product is versioned OR the root is versioned
    if (root.child.type === "productgroup") {
        // If we have a current product (either from parents or fallback), use its versions
        if (currentProduct?.child.type === "versioned") {
            versions = currentProduct.child.children;
        }
    } else if (root.child.type === "versioned") {
        versions = root.child.children;
    }

    if (versions.length === 0) {
        return null;
    }

    const withInfo = withVersionSwitcherInfo({
        node: currentNode,
        parents: currentProduct ? [...parents, currentProduct] : parents,
        versions,
        slugMap
    });

    const versionOptions = versions.map((version): VersionDropdownItem => {
        const versionInfo = withInfo.find((info) => info.id === version.versionId);

        const slug = versionInfo?.pointsTo ?? versionInfo?.landingPage ?? versionInfo?.slug ?? version.slug;

        return {
            versionId: version.versionId,
            title: version.title,
            slug,
            defaultSlug: version.default
                ? FernNavigation.toDefaultSlug(slug, currentProduct?.slug ?? root.slug, version.slug)
                : undefined,
            icon: version.icon ? <FaIconServer icon={version.icon} /> : undefined,
            authed: version.authed,
            default: version.default,
            availability: version.availability,
            hidden: version.hidden
        };
    });
    return (
        <VersionDropdownClient
            versions={versionOptions}
            fallbackVersion={fallbackVersion}
            useDenseLayout={useDenseLayout}
            forceHeader={isCohere}
        />
    );
}
