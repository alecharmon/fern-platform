import { createEditableDocsLoader } from "@fern-api/docs-loader";
import {
  getIsSidebarFixed,
  getIsSingleOverviewPage,
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SidebarTabsRootServer } from "@fern-docs/components/sidebar/SidebarTabsRootServer";
import { SidebarRootNode } from "@fern-docs/components/sidebar/nodes/SidebarRootNode";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { EncodedDocsUrl } from "@/utils/types";

import { CreatePageButton } from "./CreatePageButton";

export default async function SidebarPage({
  params,
  searchParams,
}: {
  params: Promise<{ docsUrl: EncodedDocsUrl; slug: string[] }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { docsUrl, slug: slugArray } = await params;
  const resolvedSearchParams = await searchParams;
  const clientNodeId = resolvedSearchParams["client-node-id"];
  const session = await getCurrentSession();
  const host = await getHostFromHeaders();
  const loader = await createEditableDocsLoader(
    host,
    docsUrl,
    session?.accessToken
  );
  const [config, root] = await Promise.all([
    loader.getConfig(),
    loader.getRoot(),
  ]);

  const slug = slugjoin(slugArray);
  let found = FernNavigation.utils.findNode(root, slug);

  if (found.type !== "found") {
    // For client pages that don't exist in server navigation, we need to understand
    // the current tab context and use the default page for that tab as the foundNode
    if (found.redirect && clientNodeId) {
      // First, try to understand what tab we should be in based on the original slug
      const originalFound = FernNavigation.utils.findNode(root, slug);
      let targetTabSlug = found.redirect;

      // If we can determine the tab context from the slug structure, find the default page for that specific tab
      if (originalFound.type === "notFound") {
        // Try to find which tab this slug would belong to by checking tab prefixes
        const collector = FernNavigation.NodeCollector.collect(root);
        const tabNodes = collector
          .getNodesInOrder()
          .filter((node) => node.type === "tab") as FernNavigation.TabNode[];

        const slugParts = slug.split("/");
        for (const tab of tabNodes) {
          // Check if this client page belongs to this tab
          const tabSlugInPath = slugParts.includes(tab.slug);

          if (tabSlugInPath) {
            // Found the tab this client page should belong to
            let tabChildFound = FernNavigation.utils.findNode(root, tab.slug);

            // If the tab redirects (which is normal), follow the redirect
            if (tabChildFound.type === "redirect" && tabChildFound.redirect) {
              tabChildFound = FernNavigation.utils.findNode(
                root,
                tabChildFound.redirect
              );
            }

            if (tabChildFound.type === "found" && tabChildFound.sidebar) {
              // Use the found node's slug as the target to get the correct sidebar context
              targetTabSlug = tabChildFound.node.slug;
              break;
            }
          }
        }
      }

      found = FernNavigation.utils.findNode(root, targetTabSlug);
    } else if (found.redirect) {
      // Regular redirect logic for non-client pages
      found = FernNavigation.utils.findNode(root, found.redirect);
    }
  }
  if (found.type !== "found") {
    return null;
  }

  // these are all the "visible" nodes to prevent pruning if any of these nodes are hidden
  const visibleNodes = [...found.parents, found.node];
  const visibleNodeIds = visibleNodes.map((node) => node.id);

  const isSingleOverviewPage = getIsSingleOverviewPage(found);
  const isSidebarFixed = getIsSidebarFixed(config);

  return (
    <>
      {found.tabs && found.tabs.length > 0 && (
        <SidebarTabsRootServer loader={loader}>
          <SidebarTabsList tabs={found.tabs} />
        </SidebarTabsRootServer>
      )}
      {isSingleOverviewPage && !isSidebarFixed ? (
        <HiddenSidebar />
      ) : (
        <>
          <CreatePageButton
            root={found.sidebar}
            navigationContext={{
              currentProduct: found.currentProduct,
              currentVersion: found.currentVersion,
              currentTab: found.currentTab,
              isCurrentVersionDefault: found.isCurrentVersionDefault,
              isCurrentProductDefault: found.isCurrentProductDefault,
            }}
          />
          <SidebarRootNode
            root={found.sidebar}
            visibleNodeIds={visibleNodeIds}
            loader={loader}
          />
        </>
      )}
    </>
  );
}
