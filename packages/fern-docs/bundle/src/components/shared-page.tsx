import "server-only";

import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { withPrunedNavigationLoader } from "@fern-api/docs-server/withPrunedNavigation";
import {
    addLeadingSlash,
    conformTrailingSlash,
    getRedirectForPath,
    prepareRedirect,
    slugToHref
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import type { Slug } from "@fern-api/fdr-sdk/navigation";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { getFrontmatter, sanitizeBreaks, sanitizeMdxExpression } from "@fern-docs/mdx";
import { compact } from "es-toolkit/array";
import { notFound, permanentRedirect, redirect, unauthorized } from "next/navigation";
import React from "react";

import FeedbackPopover from "@/components/feedback/FeedbackPopover";
import { withLaunchDarkly } from "@/server/ld-adapter";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";

import { DocsMainContent } from "../app/[host]/[domain]/main";

export default async function SharedPage({ loader, slug }: { loader: DocsLoader; slug: Slug }) {
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
    const settingsPromise = loader.getSettings();

    // Await configPromise with timing
    let config;
    {
        const start = Date.now();
        console.log(`[SharedPage] calling loader.getConfig() for domain: ${loader.domain}`);
        config = await configPromise;
        const end = Date.now();
        console.log(`[SharedPage] loader.getConfig() took ${end - start}ms for domain: ${loader.domain}`);
    }

    // Await baseUrlPromise with timing for getRedirectForPath
    let baseUrl;
    {
        const start = Date.now();
        console.log(`[SharedPage] calling loader.getMetadata() for domain: ${loader.domain}`);
        baseUrl = await baseUrlPromise;
        const end = Date.now();
        console.log(`[SharedPage] loader.getMetadata() took ${end - start}ms for domain: ${loader.domain}`);
    }

    // check for redirects
    const configuredRedirect = getRedirectForPath(slugToHref(slug), baseUrl, config.redirects);

    if (configuredRedirect != null) {
        console.log(
            `[REDIRECT RULE] domain: ${loader.domain}, from: ${slug} -> to: ${configuredRedirect.destination}, permanent: ${configuredRedirect.permanent}`
        );
        const redirectFn = configuredRedirect.permanent ? permanentRedirect : redirect;
        redirectFn(prepareRedirect(configuredRedirect.destination));
    }

    // get the root node with timing
    let root: FernNavigation.RootNode | undefined;
    {
        const start = Date.now();
        console.log(`[SharedPage] calling loader.getRoot() for domain: ${loader.domain}`);
        root = await rootPromise;
        const end = Date.now();
        console.log(`[SharedPage] loader.getRoot() took ${end - start}ms for domain: ${loader.domain}`);
    }

    // always match the basepath of the root node
    if (!slug.startsWith(root.slug)) {
        redirect(prepareRedirect(root.slug));
    }

    // naively find the current node id to prune the navigation tree
    const currentNode = FernNavigation.NodeCollector.collect(root).getSlugMapWithParents().get(slug);

    // Await authStatePromise with timing
    let authState;
    {
        const start = Date.now();
        console.log(`[SharedPage] calling loader.getAuthState() for domain: ${loader.domain}`);
        authState = await authStatePromise;
        const end = Date.now();
        console.log(`[SharedPage] loader.getAuthState() took ${end - start}ms for domain: ${loader.domain}`);
    }

    // this is a special case for when the user is not authenticated, but the not-found status originates from an authed node
    // must be checked before pruning auth tree
    if (currentNode?.node.authed && !authState.authed && authState.authorizationUrl != null) {
        redirect(prepareRedirect(authState.authorizationUrl));
    }

    const visibleNodeIds = compact([
        ...(currentNode?.parents.map((node) => node.id) ?? []),
        currentNode?.node.id ?? undefined
    ]);

    // prune the tree so that neighbors don't include authed nodes or hidden nodes
    {
        const start = Date.now();
        root = await withPrunedNavigationLoader(root, loader, visibleNodeIds);
        const end = Date.now();
        console.log(`[SharedPage] withPrunedNavigationLoader() took ${end - start}ms`);
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
        console.log(`[SharedPage] calling loader.getEdgeFlags() for domain: ${loader.domain}`);
        edgeFlags = await edgeFlagsPromise;
        const end = Date.now();
        console.log(`[SharedPage] loader.getEdgeFlags() took ${end - start}ms for domain: ${loader.domain}`);
    }

    if (found.type === "notFound") {
        console.error(`[${loader.domain}] Not found: ${slug}`);

        const settings = await settingsPromise;

        // Log 404 detection details for debugging
        console.log(`[404 DEBUG] domain: ${loader.domain}, slug: ${slug}`, {
            is404PageHidden: edgeFlags.is404PageHidden,
            settingsHide404Page: settings.hide404Page,
            hasRedirect: found.redirect != null,
            redirect: found.redirect
        });

        // returning "notFound: true" here renders our custom 404 page (not-found.tsx)
        if ((edgeFlags.is404PageHidden || settings.hide404Page) && found.redirect != null) {
            console.log(`[404 AVOIDED] Redirecting ${slug} -> ${found.redirect} instead of showing 404`);
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
                const slugWithVersion = FernNavigation.slugjoin(versionSlug, url.pathname);
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
            path: found.node.slug
        },
        replaceHref,
        useNextMdx: false
    });

    const serializeNextMdx = edgeFlags.isNextMdxRef
        ? createCachedMdxSerializer(loader, {
              scope: {
                  product: found?.currentProduct?.productId,
                  version: found?.currentVersion?.versionId,
                  tab: found?.currentTab?.title,
                  path: found.node.slug
              },
              replaceHref,
              useNextMdx: true
          })
        : undefined;

    // even if nav-links are globally disabled, we should calculate the neighbors
    // in case the page overrides this global setting
    const neighborsPromise = (async () => {
        const start = Date.now();
        const result = await getNeighbors(loader, found);
        const end = Date.now();
        console.log(`[SharedPage] getNeighbors() took ${end - start}ms`);
        return result;
    })();

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

    if (![...found.parents, found.node].filter(FernNavigation.hasMetadata).every((node) => flagPredicate(node))) {
        console.error(`[${loader.domain}] Feature flag predicate failed: ${slug}`);
        notFound();
    }

    // note: we start from the version node because endpoint Ids can be duplicated across versions
    // if we introduce versioned sections, and versioned api references, this logic will need to change
    // const apiReferenceNodes = FernNavigation.utils.collectApiReferences(
    //   found.currentVersion ?? found.node
    // );

    const FeedbackPopoverProvider = edgeFlags.isInlineFeedbackEnabled ? FeedbackPopover : React.Fragment;

    // Await neighborsPromise with timing
    let neighbors;
    {
        const start = Date.now();
        neighbors = await neighborsPromise;
        const end = Date.now();
        console.log(`[SharedPage] neighborsPromise (getNeighbors) took ${end - start}ms`);
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
                variantId={found.currentVariant?.variantId}
                versionIsDefault={found.isCurrentVersionDefault}
                productIsDefault={found.isCurrentProductDefault}
            />
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

async function getNeighbor(
    loader: DocsLoader,
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
            title: node.title
        };
    }
    try {
        const start = Date.now();
        const page = await loader.getPage(pageId);
        const fetchEnd = Date.now();
        console.log(`[getNeighbor] loader.getPage(${pageId}) took ${fetchEnd - start}ms for domain: ${loader.domain}`);

        // Extract frontmatter without full MDX serialization (much faster!)
        let content = sanitizeBreaks(page.markdown);
        content = sanitizeMdxExpression(content)[0];

        const { data: frontmatter } = getFrontmatter(content);
        const parseEnd = Date.now();
        console.log(`[getNeighbor] frontmatter parsing for ${pageId} took ${parseEnd - fetchEnd}ms`);

        const excerpt = frontmatter?.subtitle ?? frontmatter?.excerpt;
        const title = frontmatter?.title ?? node.title;

        return {
            href: slugToHref(node.slug),
            title,
            excerpt
        };
    } catch (error) {
        console.error(`[shared-page:get-neighbor] ${JSON.stringify(error)}`);
        return {
            href: slugToHref(node.slug),
            title: node.title
        };
    }
}

async function getNeighbors(
    loader: DocsLoader,
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
        [prev, next] = await Promise.all([getNeighbor(loader, neighbors.prev), getNeighbor(loader, neighbors.next)]);
        const end = Date.now();
        console.log(`[getNeighbors] getNeighbor() calls took ${end - start}ms`);
    }
    return { prev, next };
}
