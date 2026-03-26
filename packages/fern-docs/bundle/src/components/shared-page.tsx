import "server-only";

import type { CachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
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
import { logger } from "@fern-api/ui-core-utils/logger";
import { SetCurrentNavigationNode } from "@fern-docs/components/state/navigation";
import { getFrontmatter, sanitizeBreaks, sanitizeMdxExpression } from "@fern-docs/mdx";
import { compact } from "es-toolkit/array";
import { notFound, permanentRedirect, redirect, unauthorized } from "next/navigation";
import { cache } from "react";
import { setDocsLoaderContext } from "@/context/DocsLoaderContext";
import { setMdxSerializer } from "@/context/MdxSerializerContext";
import { setCurrentPageSlug } from "@/context/PageSlugContext";
import { withLaunchDarkly } from "@/server/ld-adapter";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";
import {
    createBatchingRemoteMdxSerializer,
    getRemoteMDXRenderingConfig,
    setEdgeConfigOverride,
    withShadowRemoteSerializer
} from "@/server/remote-renderer";
import { runAsyncSpan } from "@/server/tracing";

import { DocsMainContent } from "../app/[host]/[domain]/main";

function slugToAttribute(slug: Slug): string {
    return Array.isArray(slug) ? slug.join("/") : slug;
}

export default async function SharedPage({ loader, slug }: { loader: CachedDocsLoader; slug: Slug }) {
    if (slug.endsWith(".js")) {
        logger.debug(`[SharedPage] returning early not found for ${slug}`);
        return notFound();
    }

    const slugAttr = slugToAttribute(slug);

    return runAsyncSpan(
        "sharedPage",
        async (span) => {
            span.setAttributes({
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });

            // start loading the root node early with spans
            const rootPromise = runAsyncSpan("sharedPage.loader.getRoot", () => loader.getRoot(), {
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });
            const baseUrlPromise = runAsyncSpan("sharedPage.loader.getMetadata", () => loader.getMetadata(), {
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });
            const configPromise = runAsyncSpan("sharedPage.loader.getConfig", () => loader.getConfig(), {
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });
            const authStatePromise = runAsyncSpan(
                "sharedPage.loader.getAuthState",
                () => loader.getAuthState(slugToHref(slug)),
                { "fern.docs.domain": loader.domain, "fern.docs.slug": slugAttr }
            );
            const edgeFlagsPromise = runAsyncSpan("sharedPage.loader.getEdgeFlags", () => loader.getEdgeFlags(), {
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });
            const settingsPromise = runAsyncSpan("sharedPage.loader.getSettings", () => loader.getSettings(), {
                "fern.docs.domain": loader.domain,
                "fern.docs.slug": slugAttr
            });

            // Await configPromise with timing
            let config;
            {
                const start = Date.now();
                logger.debug(`[SharedPage] calling loader.getConfig() for domain: ${loader.domain}`);
                config = await configPromise;
                const end = Date.now();
                logger.debug(`[SharedPage] loader.getConfig() took ${end - start}ms for domain: ${loader.domain}`);
            }

            // Await baseUrlPromise with timing for getRedirectForPath
            let baseUrl;
            {
                const start = Date.now();
                logger.debug(`[SharedPage] calling loader.getMetadata() for domain: ${loader.domain}`);
                baseUrl = await baseUrlPromise;
                const end = Date.now();
                logger.debug(`[SharedPage] loader.getMetadata() took ${end - start}ms for domain: ${loader.domain}`);
            }

            // check for redirects
            const configuredRedirect = getRedirectForPath(slugToHref(slug), baseUrl, config.redirects);

            if (configuredRedirect != null) {
                logger.info(
                    `[REDIRECT RULE] domain: ${loader.domain}, from: ${slug} -> to: ${configuredRedirect.destination}, permanent: ${configuredRedirect.permanent}`
                );
                const redirectFn = configuredRedirect.permanent ? permanentRedirect : redirect;
                redirectFn(prepareRedirect(configuredRedirect.destination));
            }

            // get the root node with timing
            let root: FernNavigation.RootNode | undefined;
            {
                const start = Date.now();
                logger.debug(`[SharedPage] calling loader.getRoot() for domain: ${loader.domain}`);
                root = await rootPromise;
                const end = Date.now();
                logger.debug(`[SharedPage] loader.getRoot() took ${end - start}ms for domain: ${loader.domain}`);
            }

            // always match the basepath of the root node
            logger.info(
                `[404 ISSUE] basepath check: slug="${slug}", root.slug="${root.slug}", startsWith=${slug.startsWith(root.slug)}, domain=${loader.domain}`
            );
            if (!slug.startsWith(root.slug)) {
                logger.info(
                    `[404 ISSUE] REDIRECTING due to basepath mismatch: slug="${slug}" does not start with root.slug="${root.slug}", redirecting to "${prepareRedirect(root.slug)}"`
                );
                redirect(prepareRedirect(root.slug));
            }

            // naively find the current node id to prune the navigation tree
            const currentNode = FernNavigation.NodeCollector.collect(root).getSlugMapWithParents().get(slug);

            // Await authStatePromise with timing
            let authState;
            {
                const start = Date.now();
                logger.debug(`[SharedPage] calling loader.getAuthState() for domain: ${loader.domain}`);
                authState = await authStatePromise;
                const end = Date.now();
                logger.debug(`[SharedPage] loader.getAuthState() took ${end - start}ms for domain: ${loader.domain}`);
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
            root = await runAsyncSpan(
                "sharedPage.withPrunedNavigationLoader",
                async () => {
                    const start = Date.now();
                    const result = await withPrunedNavigationLoader(root, loader, visibleNodeIds);
                    const end = Date.now();
                    logger.debug(`[SharedPage] withPrunedNavigationLoader() took ${end - start}ms`);
                    return result;
                },
                { "fern.docs.domain": loader.domain, "fern.docs.slug": slugAttr }
            );

            if (root == null) {
                logger.error(`[SharedPage:${loader.domain}] Could not find root`);
                notFound();
            }

            // find the node that is currently being viewed
            const found = runAsyncSpan(
                "sharedPage.findNode",
                () => Promise.resolve(FernNavigation.utils.findNode(root, slug)),
                { "fern.docs.domain": loader.domain, "fern.docs.slug": slugAttr }
            );

            // Await edgeFlagsPromise with timing
            let edgeFlags;
            {
                const start = Date.now();
                logger.debug(`[SharedPage] calling loader.getEdgeFlags() for domain: ${loader.domain}`);
                edgeFlags = await edgeFlagsPromise;
                const end = Date.now();
                logger.debug(`[SharedPage] loader.getEdgeFlags() took ${end - start}ms for domain: ${loader.domain}`);
            }

            // Set edge config override for the entire request scope.
            // All downstream calls to getRemoteMDXRenderingConfig() will pick this up
            // automatically via the request-scoped cache store.
            setEdgeConfigOverride(edgeFlags.isRemoteMdxRenderer);

            // Determine remote rendering mode, allowing per-domain override via edge config
            const {
                enabled: useRemoteRendering,
                url: remoteRendererUrl,
                batchSerializePath,
                shadow,
                mode: renderingMode
            } = getRemoteMDXRenderingConfig();

            const foundResult = await found;

            if (foundResult.type === "notFound") {
                logger.warn(`[${loader.domain}] Not found: ${slug}`);

                const settings = await settingsPromise;

                logger.info(
                    `[404 ISSUE] notFound branch reached: domain=${loader.domain}, slug="${slug}", is404PageHidden=${edgeFlags.is404PageHidden}, settingsHide404Page=${settings.hide404Page}, hasRedirect=${foundResult.redirect != null}, redirect="${foundResult.redirect}"`
                );

                // returning "notFound: true" here renders our custom 404 page (not-found.tsx)
                if ((edgeFlags.is404PageHidden || settings.hide404Page) && foundResult.redirect != null) {
                    logger.info(
                        `[404 ISSUE] REDIRECTING instead of 404: slug="${slug}" -> "${foundResult.redirect}" (is404PageHidden=${edgeFlags.is404PageHidden}, settingsHide404Page=${settings.hide404Page})`
                    );
                    // Track 404 in PostHog before redirecting to home page
                    track("not_found_redirected", {
                        domain: loader.domain,
                        slug,
                        redirect: foundResult.redirect
                    });
                    redirect(prepareRedirect(foundResult.redirect));
                }

                logger.info(`[404 ISSUE] SHOWING 404 PAGE for slug="${slug}" on domain=${loader.domain}`);
                notFound();
            }

            if (foundResult.type === "redirect") {
                redirect(prepareRedirect(foundResult.redirect));
            }

            const rootSlug = root.slug;
            const versionSlug = foundResult.currentVersion?.slug;
            const slugMap = foundResult.collector.slugMap;
            function replaceHref(href: string): string | undefined {
                if (href.startsWith("/")) {
                    const url = new URL(href, withDefaultProtocol(loader.domain));
                    if (versionSlug != null) {
                        const slugWithVersion = FernNavigation.slugjoin(versionSlug, url.pathname);
                        const foundNode = slugMap.get(slugWithVersion);
                        if (foundNode) {
                            return `${conformTrailingSlash(addLeadingSlash(foundNode.slug))}${url.search}${url.hash}`;
                        }
                    }

                    if (rootSlug.length > 0) {
                        const slugWithRoot = FernNavigation.slugjoin(rootSlug, url.pathname);
                        const foundNode = slugMap.get(slugWithRoot);
                        if (foundNode) {
                            return `${conformTrailingSlash(addLeadingSlash(foundNode.slug))}${url.search}${url.hash}`;
                        }
                    }
                }
                return;
            }

            // Cache serializer by useNextMdx to ensure single instance per request
            // Captures loader, scope, replaceHref, etc. in closure (not part of cache key)
            const getSerializer = cache((useNextMdx: boolean) => {
                const scope = {
                    product: foundResult?.currentProduct?.productId,
                    version: foundResult?.currentVersion?.versionId,
                    tab: foundResult?.currentTab?.title,
                    path: foundResult.node.slug
                };

                if (useRemoteRendering && remoteRendererUrl) {
                    return createBatchingRemoteMdxSerializer(remoteRendererUrl, loader, {
                        scope,
                        replaceHref,
                        rootSlug,
                        versionSlug,
                        slugMap,
                        useNextMdx,
                        batchSerializePath
                    });
                }

                const local = createCachedMdxSerializer(loader, { scope, replaceHref, useNextMdx });

                // Shadow mode: fire-and-forget to remote renderer for bug detection
                if (shadow && remoteRendererUrl) {
                    return withShadowRemoteSerializer(local, remoteRendererUrl, loader, {
                        scope,
                        replaceHref,
                        rootSlug,
                        versionSlug,
                        slugMap,
                        useNextMdx,
                        batchSerializePath
                    });
                }

                return local;
            });

            // Log rendering mode once (debug only)
            if (process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true") {
                if (useRemoteRendering && remoteRendererUrl) {
                    logger.debug(
                        `[SharedPage] Remote rendering ENABLED for domain: ${loader.domain} → ${remoteRendererUrl}`
                    );
                } else if (shadow && remoteRendererUrl) {
                    logger.debug(
                        `[SharedPage] Shadow remote rendering for domain: ${loader.domain} → ${remoteRendererUrl}`
                    );
                } else if (useRemoteRendering && !remoteRendererUrl) {
                    logger.debug(
                        `[SharedPage] Remote rendering enabled but REMOTE_RENDERER_URL not set, falling back to local for domain: ${loader.domain}`
                    );
                } else {
                    logger.debug(`[SharedPage] Local rendering for domain: ${loader.domain}`);
                }
            }
            const serialize = getSerializer(false);
            const serializeNextMdx = edgeFlags.isNextMdxRef ? getSerializer(true) : undefined;

            // Set global serializer for components that use getMdxSerializer() from context
            // (e.g., API endpoint descriptions, form data fields, footer content)
            // Use next-mdx-remote engine when the edge flag is enabled, matching old SharedLayout behavior
            setMdxSerializer(serializeNextMdx ?? serialize);
            setCurrentPageSlug(foundResult.node.slug);

            // even if nav-links are globally disabled, we should calculate the neighbors
            // in case the page overrides this global setting
            const neighborsPromise = runAsyncSpan(
                "sharedPage.getNeighbors",
                async () => {
                    const start = Date.now();
                    const result = await getNeighbors(loader, foundResult);
                    const end = Date.now();
                    logger.debug(`[SharedPage] getNeighbors() took ${end - start}ms`);
                    return result;
                },
                { "fern.docs.domain": loader.domain, "fern.docs.slug": slugAttr }
            );

            // if the current node requires authentication and the user is not authenticated, redirect to the auth page
            if (foundResult.node.authed && !authState.authed) {
                logger.error(`[${loader.domain}] Not authed: ${slug}`);

                // if the page can be considered an edge node when it's unauthed, then we'll follow the redirect
                if (FernNavigation.hasRedirect(foundResult.node)) {
                    redirect(prepareRedirect(foundResult.node.pointsTo));
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
                const [, predicate] = await runAsyncSpan(
                    "sharedPage.withLaunchDarkly",
                    async () => {
                        const start = Date.now();
                        const result = await withLaunchDarkly(loader, foundResult);
                        const end = Date.now();
                        logger.debug(`[SharedPage] withLaunchDarkly() took ${end - start}ms`);
                        return result;
                    },
                    { "fern.docs.domain": loader.domain, "fern.docs.slug": slugAttr }
                );
                flagPredicate = predicate;
            }

            if (
                ![...foundResult.parents, foundResult.node]
                    .filter(FernNavigation.hasMetadata)
                    .every((node) => flagPredicate(node))
            ) {
                logger.error(`[${loader.domain}] Feature flag predicate failed: ${slug}`);
                notFound();
            }

            // note: we start from the version node because endpoint Ids can be duplicated across versions
            // if we introduce versioned sections, and versioned api references, this logic will need to change
            // const apiReferenceNodes = FernNavigation.utils.collectApiReferences(
            //   foundResult.currentVersion ?? foundResult.node
            // );

            // Await neighborsPromise with timing
            let neighbors;
            {
                const start = Date.now();
                neighbors = await neighborsPromise;
                const end = Date.now();
                logger.debug(`[SharedPage] neighborsPromise (getNeighbors) took ${end - start}ms`);
            }

            const lang = await loader.getLanguage();

            // Set global loader for components that need it (e.g., MdxServerComponentProseSuspense
            // for resolving widget data outside the Suspense boundary)
            setDocsLoaderContext(loader, lang);

            // Set additional attributes now that we know the node
            const pageId = FernNavigation.getPageId(foundResult.node);
            span.setAttributes({
                "fern.docs.nodeId": foundResult.node.id,
                ...(pageId ? { "fern.docs.pageId": pageId } : {})
            });

            return (
                <>
                    {renderingMode !== "disabled" && <meta name="fern:rendering-mode" content={renderingMode} />}
                    <SetCurrentNavigationNode
                        nodeId={foundResult.node.id}
                        sidebarRootNodeId={foundResult.sidebar?.id}
                        tabId={foundResult.currentTab?.id}
                        productId={foundResult.currentProduct?.productId}
                        productSlug={
                            foundResult.currentProduct?.type === "product" ? foundResult.currentProduct.slug : undefined
                        }
                        versionId={foundResult.currentVersion?.versionId}
                        versionSlug={foundResult.currentVersion?.slug}
                        variantId={foundResult.currentVariant?.variantId}
                        versionIsDefault={foundResult.isCurrentVersionDefault}
                        productIsDefault={foundResult.isCurrentProductDefault}
                    />
                    <DocsMainContent
                        loader={loader}
                        serialize={serialize}
                        serializeNextMdx={serializeNextMdx}
                        node={foundResult.node}
                        parents={foundResult.parents}
                        neighbors={neighbors}
                        breadcrumb={foundResult.breadcrumb}
                        lang={lang}
                        showUnionsAsDropdown={edgeFlags.isDiscriminatedUnionDropdownEnabled}
                    />
                </>
            );
        },
        {
            "fern.docs.domain": loader.domain,
            "fern.docs.slug": slugAttr
        }
    );
}

async function getNeighbor(
    loader: CachedDocsLoader,
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
        logger.debug(`[getNeighbor] loader.getPage(${pageId}) took ${fetchEnd - start}ms for domain: ${loader.domain}`);

        // Extract frontmatter without full MDX serialization (much faster!)
        let content = sanitizeBreaks(page.markdown);
        content = sanitizeMdxExpression(content)[0];

        const { data: frontmatter } = getFrontmatter(content);
        const parseEnd = Date.now();
        logger.debug(`[getNeighbor] frontmatter parsing for ${pageId} took ${parseEnd - fetchEnd}ms`);

        const excerpt = frontmatter?.subtitle ?? frontmatter?.excerpt;
        const title = frontmatter?.title ?? node.title;

        return {
            href: slugToHref(node.slug),
            title,
            excerpt
        };
    } catch (error) {
        logger.error(`[shared-page:get-neighbor] ${JSON.stringify(error)}`);
        return {
            href: slugToHref(node.slug),
            title: node.title
        };
    }
}

async function getNeighbors(
    loader: CachedDocsLoader,
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
        logger.debug(`[getNeighbors] getNeighbor() calls took ${end - start}ms`);
    }
    return { prev, next };
}
