import { slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { createRoleFacet, createViewersForNodes } from "@fern-docs/search-utils";

import type { BaseRecord } from "../types";

interface CreateBaseRecordOptions {
    domain: string;
    org_id: string;
    parents: readonly FernNavigation.NavigationNodeParent[];
    node: FernNavigation.NavigationNodeWithMetadata;
    authed: boolean;
}

export function createBaseRecord({
    domain,
    org_id,
    parents,
    node,
    authed: isDocsSiteAuthed
}: CreateBaseRecordOptions): BaseRecord {
    const productNode = parents.find((n): n is FernNavigation.ProductNode => n.type === "product");
    const versionNode = parents.find((n): n is FernNavigation.VersionNode => n.type === "version");
    const tabNode = parents.find((n): n is FernNavigation.TabNode => n.type === "tab");
    const sidebarRootIdx = parents.findIndex((n): n is FernNavigation.SidebarRootNode => n.type === "sidebarRoot");

    const breadcrumb =
        sidebarRootIdx <= 0
            ? []
            : parents
                  // we don't want to include the product, version, or tab in the breadcrumb
                  .slice(sidebarRootIdx + 1)
                  .filter(
                      (
                          n
                      ): n is Extract<FernNavigation.NavigationNodeWithMetadata, FernNavigation.NavigationNodeParent> =>
                          FernNavigation.hasMetadata(n)
                  )
                  // Changelog months and years should not be included in the breadcrumb
                  .filter((n) => n.type !== "changelogMonth" && n.type !== "changelogYear")
                  .map((metadata) => ({
                      title: metadata.title,
                      pathname: slugToHref(metadata.canonicalSlug ?? metadata.slug)
                  }));

    const { roles, authed } = createViewersForNodes([...parents, node], isDocsSiteAuthed);

    return {
        objectID: `${org_id}:${domain}:${node.id}`,
        org_id,
        domain,
        canonicalPathname: slugToHref(node.canonicalSlug ?? node.slug),
        pathname: slugToHref(node.slug),
        icon: node.icon,
        title: node.title,
        breadcrumb,
        product: productNode
            ? {
                  id: productNode.productId,
                  title: productNode.title,
                  pathname: `/${productNode.canonicalSlug ?? productNode.slug}`
              }
            : undefined,
        version: versionNode
            ? {
                  id: versionNode.versionId,
                  title: versionNode.title,
                  pathname: `/${versionNode.canonicalSlug ?? versionNode.slug}`
              }
            : undefined,
        tab: tabNode
            ? {
                  title: tabNode.title,
                  pathname: `/${tabNode.canonicalSlug ?? tabNode.slug}`
              }
            : undefined,
        visible_by: roles.map(createRoleFacet),
        authed,
        page_position: 0
    };
}
