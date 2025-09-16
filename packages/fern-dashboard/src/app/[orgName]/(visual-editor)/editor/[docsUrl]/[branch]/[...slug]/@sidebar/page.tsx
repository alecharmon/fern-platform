import {
  PrefetchedDocsLoader,
  createEditableDocsLoader,
} from "@fern-api/docs-loader";
import {
  getIsSidebarFixed,
  getIsSingleOverviewPage,
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { getClientPageRedirectTarget } from "@fern-docs/components";
import { SidebarClientTabsRoot } from "@fern-docs/components/sidebar/SidebarClientTabsRoot";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SidebarClientRootNode } from "@fern-docs/components/sidebar/nodes/SidebarClientRootNode";
import { HiddenSidebar } from "@fern-docs/components/theming/HiddenSidebar";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { EncodedDocsUrl } from "@/utils/types";

import { CreatePageButton } from "./CreatePageButton";

export default async function SidebarPage({
  params,
  searchParams,
}: {
  params: Promise<{ docsUrl: EncodedDocsUrl; slug: string[]; branch: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { docsUrl, slug: slugArray, branch } = await params;
  const resolvedSearchParams = await searchParams;
  const clientNodeId = resolvedSearchParams["client-node-id"];
  const session = await getCurrentSession();
  const host = await getHostFromHeaders();
  const loader = await createEditableDocsLoader({
    host,
    encodedDocsUrl: docsUrl,
    fernToken: session?.accessToken,
    branchName: branch,
  });
  const [config, root, authState, edgeFlags, layout] = await Promise.all([
    loader.getConfig(),
    loader.getRoot(),
    loader.getAuthState(),
    loader.getEdgeFlags(),
    loader.getLayout(),
  ]);
  const prefetchedLoaderData = new PrefetchedDocsLoader({
    domain: loader.domain,
    authState,
    edgeFlags,
    layout,
  }).serializable();

  const slug = slugjoin(slugArray);
  let found = FernNavigation.utils.findNode(root, slug);

  if (found.type !== "found") {
    // For client pages that don't exist in server navigation, we need to understand
    // the current tab context and use the default page for that tab as the foundNode
    if (found.redirect && clientNodeId) {
      const targetTabSlug = getClientPageRedirectTarget(
        root,
        slug,
        found.redirect
      );
      found = FernNavigation.utils.findNode(
        root,
        FernNavigation.Slug(targetTabSlug)
      );
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
        <SidebarClientTabsRoot loaderData={prefetchedLoaderData}>
          <SidebarTabsList tabs={found.tabs} />
        </SidebarClientTabsRoot>
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
          <SidebarClientRootNode
            root={found.sidebar}
            visibleNodeIds={visibleNodeIds}
            loaderData={prefetchedLoaderData}
          />
        </>
      )}
    </>
  );
}
