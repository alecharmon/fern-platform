import "server-only";

import { redirect } from "next/navigation";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getTabs } from "@fern-api/docs-server/handle-node-fallbacks";
import {
  getIsSidebarFixed,
  getIsSingleOverviewPage,
  slugToHref,
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { SidebarTabsList } from "@fern-docs/components/sidebar/SidebarTabsList";
import { SidebarTabsRoot } from "@fern-docs/components/sidebar/SidebarTabsRoot";
import { SidebarRootNode } from "@fern-docs/components/sidebar/nodes/SidebarRootNode";
import { HiddenSidebar } from "@fern-docs/components/state/layout";

import { getFernToken } from "@/app/fern-token";

export default async function SidebarPage({
  params,
}: {
  params: Promise<{ host: string; domain: string; slug: string }>;
}) {
  const { host, domain, slug } = await params;
  const loader = await createCachedDocsLoader(
    host,
    domain,
    await getFernToken()
  );
  const config = await loader.getConfig();
  const isSidebarFixed = getIsSidebarFixed(config);

  const showHiddenNodes = (await loader.getEdgeFlags())
    .isAuthenticatedPagesDiscoverable;

  const root = await loader.getRoot();

  const authState = await loader.getAuthState();

  // preload:
  await loader.getLayout();

  const found = FernNavigation.utils.findNode(root, slugjoin(slug));
  if (found.type !== "found") {
    // explicitly redirect the sidebar slot for dynamic pages to avoid race condition => empty sidebar
    if (found.type === "redirect") {
      redirect(prepareRedirect(found.redirect));
    }

    return null;
  }

  // these are all the "visible" nodes to prevent pruning if any of these nodes are hidden
  const visibleNodes = [...found.parents, found.node];
  const visibleNodeIds = visibleNodes.map((node) => node.id);

  const isSingleOverviewPage = getIsSingleOverviewPage(found);

  const tabs = getTabs(
    found,
    root,
    slug,
    showHiddenNodes,
    authState.authed ? (authState.user.roles ?? []) : []
  );

  return (
    <>
      {tabs && tabs.length > 0 && (
        <SidebarTabsRoot loader={loader}>
          <SidebarTabsList tabs={tabs} />
        </SidebarTabsRoot>
      )}
      {isSingleOverviewPage && !isSidebarFixed ? (
        <HiddenSidebar />
      ) : (
        <SidebarRootNode
          root={found.sidebar}
          visibleNodeIds={visibleNodeIds}
          loader={loader}
        />
      )}
    </>
  );
}

function prepareRedirect(destination: string): string {
  if (destination.startsWith("http://") || destination.startsWith("https://")) {
    // triggers a throw in the server-side if the destination url is invalid
    const url = new URL(destination);
    destination = String(url);
  } else {
    destination = encodeURI(slugToHref(destination));
  }
  return destination;
}
