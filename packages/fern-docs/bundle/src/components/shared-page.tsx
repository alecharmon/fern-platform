import "server-only";

import {
  notFound,
  permanentRedirect,
  redirect,
  unauthorized,
} from "next/navigation";
import React from "react";

import { compact } from "es-toolkit/array";

import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { withPrunedNavigationLoader } from "@fern-api/docs-server/withPrunedNavigation";
import {
  addLeadingSlash,
  conformTrailingSlash,
  getRedirectForPath,
  slugToHref,
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { Slug } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";

import FeedbackPopover from "@/components/feedback/FeedbackPopover";
import { withLaunchDarkly } from "@/server/ld-adapter";
import {
  MdxSerializer,
  createCachedMdxSerializer,
} from "@/server/mdx-serializer";

import { DocsMainContent } from "../app/[host]/[domain]/main";

export default async function SharedPage({
  loader,
  slug,
}: {
  loader: DocsLoader;
  slug: Slug;
}) {
  if (slug.endsWith(".js")) {
    console.debug(`[SharedPage] returning early not found for ${slug}`);
    return notFound();
  }

  console.debug("/app/[domain]/_page.tsx: starting...");

  // start loading the root node early
  const rootPromise = loader.getRoot();
  const baseUrlPromise = loader.getMetadata();
  const configPromise = loader.getConfig();
  const authStatePromise = loader.getAuthState(slugToHref(slug));
  const edgeFlagsPromise = loader.getEdgeFlags();

  // check for redirects
  const configuredRedirect = getRedirectForPath(
    slugToHref(slug),
    await baseUrlPromise,
    (await configPromise).redirects
  );

  if (configuredRedirect != null) {
    const redirectFn = configuredRedirect.permanent
      ? permanentRedirect
      : redirect;
    redirectFn(prepareRedirect(configuredRedirect.destination));
  }

  // get the root node
  let root: FernNavigation.RootNode | undefined = await rootPromise;

  // always match the basepath of the root node
  if (!slug.startsWith(root.slug)) {
    redirect(prepareRedirect(root.slug));
  }

  // naively find the current node id to prune the navigation tree
  const currentNode = FernNavigation.NodeCollector.collect(root)
    .getSlugMapWithParents()
    .get(slug);

  const authState = await authStatePromise;

  // this is a special case for when the user is not authenticated, but the not-found status originates from an authed node
  // must be checked before pruning auth tree
  if (
    currentNode?.node.authed &&
    !authState.authed &&
    authState.authorizationUrl != null
  ) {
    redirect(prepareRedirect(authState.authorizationUrl));
  }

  const visibleNodeIds = compact([
    ...(currentNode?.parents.map((node) => node.id) ?? []),
    currentNode?.node.id ?? undefined,
  ]);

  // prune the tree so that neighbors don't include authed nodes or hidden nodes
  root = await withPrunedNavigationLoader(root, loader, visibleNodeIds);

  if (root == null) {
    console.error(`[SharedPage:${loader.domain}] Could not find root`);
    notFound();
  }

  // find the node that is currently being viewed
  const found = FernNavigation.utils.findNode(root, slug);

  const edgeFlags = await edgeFlagsPromise;

  if (found.type === "notFound") {
    console.error(`[${loader.domain}] Not found: ${slug}`);

    // returning "notFound: true" here renders our custom 404 page (not-found.tsx)
    if (edgeFlags.is404PageHidden && found.redirect != null) {
      redirect(prepareRedirect(found.redirect));
    }

    console.error(`[SharedPage:${loader.domain}] Not found: ${slug}`);
    notFound();
  }

  if (found.type === "redirect") {
    redirect(prepareRedirect(found.redirect));
  }

  const rootSlug = root.slug;
  const versionSlug = found.currentVersion?.slug;
  const slugMap = found.collector.slugMap;
  function replaceHref(href: string): string | undefined {
    if (href.startsWith("/")) {
      const url = new URL(href, withDefaultProtocol(loader.domain));
      if (versionSlug != null) {
        const slugWithVersion = FernNavigation.slugjoin(
          versionSlug,
          url.pathname
        );
        const found = slugMap.get(slugWithVersion);
        if (found) {
          return `${conformTrailingSlash(addLeadingSlash(found.slug))}${url.search}${url.hash}`;
        }
      }

      if (rootSlug.length > 0) {
        const slugWithRoot = FernNavigation.slugjoin(rootSlug, url.pathname);
        const found = slugMap.get(slugWithRoot);
        if (found) {
          return `${conformTrailingSlash(addLeadingSlash(found.slug))}${url.search}${url.hash}`;
        }
      }
    }
    return;
  }

  const serialize = createCachedMdxSerializer(loader, {
    scope: {
      product: found?.currentProduct?.productId,
      version: found?.currentVersion?.versionId,
      tab: found?.currentTab?.title,
      path: found.node.slug,
    },
    replaceHref,
    useNextMdx: false,
  });

  const serializeNextMdx = edgeFlags.isNextMdxRef
    ? createCachedMdxSerializer(loader, {
        scope: {
          product: found?.currentProduct?.productId,
          version: found?.currentVersion?.versionId,
          tab: found?.currentTab?.title,
          path: found.node.slug,
        },
        replaceHref,
        useNextMdx: true,
      })
    : undefined;

  const neighborsPromise = getNeighbors(
    loader,
    serializeNextMdx ?? serialize,
    found
  );

  // if the current node requires authentication and the user is not authenticated, redirect to the auth page
  if (found.node.authed && !authState.authed) {
    console.error(`[${loader.domain}] Not authed: ${slug}`);

    // if the page can be considered an edge node when it's unauthed, then we'll follow the redirect
    if (FernNavigation.hasRedirect(found.node)) {
      redirect(prepareRedirect(found.node.pointsTo));
    }

    if (authState.authorizationUrl == null) {
      unauthorized();
    }

    redirect(prepareRedirect(authState.authorizationUrl));
  }

  const { isPreview } = await baseUrlPromise;

  // handle authed preview pages
  if (!authState.authed && edgeFlags.isAuthedPreview && isPreview) {
    if (authState.authorizationUrl == null) {
      unauthorized();
    }

    redirect(prepareRedirect(authState.authorizationUrl));
  }

  // TODO: parallelize this with the other edge config calls:
  const [_, flagPredicate] = await withLaunchDarkly(loader, found);

  if (
    ![...found.parents, found.node]
      .filter(FernNavigation.hasMetadata)
      .every((node) => flagPredicate(node))
  ) {
    console.error(`[${loader.domain}] Feature flag predicate failed: ${slug}`);
    notFound();
  }

  // note: we start from the version node because endpoint Ids can be duplicated across versions
  // if we introduce versioned sections, and versioned api references, this logic will need to change
  // const apiReferenceNodes = FernNavigation.utils.collectApiReferences(
  //   found.currentVersion ?? found.node
  // );

  const FeedbackPopoverProvider = edgeFlags.isInlineFeedbackEnabled
    ? FeedbackPopover
    : React.Fragment;

  return (
    <FeedbackPopoverProvider>
      <SetCurrentNavigationNode
        nodeId={found.node.id}
        sidebarRootNodeId={found.sidebar?.id}
        tabId={found.currentTab?.id}
        productId={found.currentProduct?.productId}
        productSlug={found.currentProduct?.slug}
        versionId={found.currentVersion?.versionId}
        versionSlug={found.currentVersion?.slug}
        versionIsDefault={found.isCurrentVersionDefault}
        productIsDefault={found.isCurrentProductDefault}
      />
      <DocsMainContent
        loader={loader}
        serialize={serialize}
        serializeNextMdx={serializeNextMdx}
        node={found.node}
        parents={found.parents}
        neighbors={await neighborsPromise}
        breadcrumb={found.breadcrumb}
      />
    </FeedbackPopoverProvider>
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

async function getNeighbor(
  loader: DocsLoader,
  serialize: MdxSerializer,
  node: FernNavigation.NavigationNodeNeighbor | undefined
): Promise<
  | {
      href: string;
      title: string;
      excerpt?: string;
    }
  | undefined
> {
  if (node == null) {
    return undefined;
  }
  const pageId = FernNavigation.getPageId(node);
  if (pageId == null) {
    return {
      href: slugToHref(node.slug),
      title: node.title,
    };
  }
  try {
    const page = await loader.getPage(pageId);
    const mdx = await serialize(page.markdown, {
      filename: page.filename,
      slug: node.slug,
      toc: true, // this is probably already cached with toc: true
    });
    const excerpt = mdx?.frontmatter?.subtitle ?? mdx?.frontmatter?.excerpt;
    return {
      href: slugToHref(node.slug),
      title: mdx?.frontmatter?.title ?? node.title,
      excerpt,
    };
  } catch (error) {
    console.error(`[shared-page:get-neighbor] ${JSON.stringify(error)}`);
    return {
      href: slugToHref(node.slug),
      title: node.title,
    };
  }
}

async function getNeighbors(
  loader: DocsLoader,
  serialize: MdxSerializer,
  neighbors: {
    prev: FernNavigation.NavigationNodeNeighbor | undefined;
    next: FernNavigation.NavigationNodeNeighbor | undefined;
  }
): Promise<{
  prev?: {
    href: string;
    title: string;
    excerpt?: string;
  };
  next?: {
    href: string;
    title: string;
    excerpt?: string;
  };
}> {
  const [prev, next] = await Promise.all([
    getNeighbor(loader, serialize, neighbors.prev),
    getNeighbor(loader, serialize, neighbors.next),
  ]);
  return { prev, next };
}
