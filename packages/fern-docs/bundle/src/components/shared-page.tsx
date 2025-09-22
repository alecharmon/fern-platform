import "server-only";

import { unstable_cache } from "next/cache";
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
import { QueryParamProcessor } from "@/hooks/QueryParamProcessor";
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

  // Await configPromise with timing
  let config;
  {
    const start = Date.now();
    config = await configPromise;
    const end = Date.now();
    console.log(`[SharedPage] loader.getConfig() took ${end - start}ms`);
  }

  // Await baseUrlPromise with timing for getRedirectForPath
  let baseUrl;
  {
    const start = Date.now();
    baseUrl = await baseUrlPromise;
    const end = Date.now();
    console.log(`[SharedPage] loader.getMetadata() took ${end - start}ms`);
  }

  // check for redirects
  const configuredRedirect = getRedirectForPath(
    slugToHref(slug),
    baseUrl,
    config.redirects
  );

  if (configuredRedirect != null) {
    const redirectFn = configuredRedirect.permanent
      ? permanentRedirect
      : redirect;
    redirectFn(prepareRedirect(configuredRedirect.destination));
  }

  // get the root node with timing
  let root: FernNavigation.RootNode | undefined;
  {
    const start = Date.now();
    root = await rootPromise;
    const end = Date.now();
    console.log(`[SharedPage] loader.getRoot() took ${end - start}ms`);
  }

  // always match the basepath of the root node
  if (!slug.startsWith(root.slug)) {
    redirect(prepareRedirect(root.slug));
  }

  // naively find the current node id to prune the navigation tree
  const currentNode = FernNavigation.NodeCollector.collect(root)
    .getSlugMapWithParents()
    .get(slug);

  // Await authStatePromise with timing
  let authState;
  {
    const start = Date.now();
    authState = await authStatePromise;
    const end = Date.now();
    console.log(`[SharedPage] loader.getAuthState() took ${end - start}ms`);
  }

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
  {
    const start = Date.now();
    root = await withPrunedNavigationLoader(root, loader, visibleNodeIds);
    const end = Date.now();
    console.log(
      `[SharedPage] withPrunedNavigationLoader() took ${end - start}ms`
    );
  }

  if (root == null) {
    console.error(`[SharedPage:${loader.domain}] Could not find root`);
    notFound();
  }

  // find the node that is currently being viewed
  const found = FernNavigation.utils.findNode(root, slug);

  // Await edgeFlagsPromise with timing
  let edgeFlags;
  {
    const start = Date.now();
    edgeFlags = await edgeFlagsPromise;
    const end = Date.now();
    console.log(`[SharedPage] loader.getEdgeFlags() took ${end - start}ms`);
  }

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

  // even if nav-links are globally disabled, we should calculate the neighbors
  // in case the page overrides this global setting
  const neighborsPromise = unstable_cache(
    async () => {
      const start = Date.now();
      const result = await getNeighbors(
        loader,
        serializeNextMdx ?? serialize,
        found
      );
      const end = Date.now();
      console.log(`[SharedPage] getNeighbors() took ${end - start}ms`);
      return result;
    },
    [
      "getNeighbors",
      loader.domain,
      found.node.slug,
      found.currentProduct?.productId ?? "",
      found.currentVersion?.versionId ?? "",
      found.currentTab?.title ?? "",
      serializeNextMdx ? "nextMdx" : "mdx",
    ],
    { tags: [loader.domain, "getNeighbors"] }
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

  // isPreview is from baseUrl
  const isPreview = baseUrl.isPreview;

  // handle authed preview pages
  if (!authState.authed && edgeFlags.isAuthedPreview && isPreview) {
    if (authState.authorizationUrl == null) {
      unauthorized();
    }

    redirect(prepareRedirect(authState.authorizationUrl));
  }

  // TODO: parallelize this with the other edge config calls:
  let flagPredicate;
  {
    const start = Date.now();
    const launchDarklyResult = await withLaunchDarkly(loader, found);
    flagPredicate = launchDarklyResult[1];
    const end = Date.now();
    console.log(`[SharedPage] withLaunchDarkly() took ${end - start}ms`);
  }

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

  // Await neighborsPromise with timing
  let neighbors;
  {
    const start = Date.now();
    neighbors = await neighborsPromise();
    const end = Date.now();
    console.log(
      `[SharedPage] neighborsPromise (getNeighbors) took ${end - start}ms`
    );
  }

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
        productIsDefault={found.isCurrentProductIsDefault}
      />
      <QueryParamProcessor />
      <DocsMainContent
        loader={loader}
        serialize={serialize}
        serializeNextMdx={serializeNextMdx}
        node={found.node}
        parents={found.parents}
        neighbors={neighbors}
        breadcrumb={found.breadcrumb}
        globalLayout={config.layout}
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
    let page, mdx;
    {
      const start = Date.now();
      page = await loader.getPage(pageId);
      const end = Date.now();
      console.log(
        `[getNeighbor] loader.getPage(${pageId}) took ${end - start}ms`
      );
    }
    {
      const start = Date.now();
      mdx = await serialize(page.markdown, {
        filename: page.filename,
        slug: node.slug,
        toc: true, // this is probably already cached with toc: true
      });
      const end = Date.now();
      console.log(
        `[getNeighbor] serialize() for ${node.slug} took ${end - start}ms`
      );
    }
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
  let prev, next;
  {
    const start = Date.now();
    [prev, next] = await Promise.all([
      getNeighbor(loader, serialize, neighbors.prev),
      getNeighbor(loader, serialize, neighbors.next),
    ]);
    const end = Date.now();
    console.log(`[getNeighbors] getNeighbor() calls took ${end - start}ms`);
  }
  return { prev, next };
}
