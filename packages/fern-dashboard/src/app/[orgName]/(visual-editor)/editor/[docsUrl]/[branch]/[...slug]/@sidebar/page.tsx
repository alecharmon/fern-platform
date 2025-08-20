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
}: {
  params: Promise<{ docsUrl: EncodedDocsUrl; slug: string }>;
}) {
  const { docsUrl, slug } = await params;
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

  let found = FernNavigation.utils.findNode(root, slugjoin(slug));
  if (found.type !== "found") {
    // TODO: this is a placeholder, replace with real logic
    found = FernNavigation.utils.findNode(root, slugjoin(["welcome"]));
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
          <CreatePageButton root={found.sidebar} />
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
