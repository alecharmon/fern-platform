import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import {
    conformExplorerRoute,
    conformTrailingSlash,
    getRedirectForPath,
    prepareRedirect,
    slugToHref
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { permanentRedirect, RedirectType, redirect } from "next/navigation";
import React from "react";

import { ExplorerContent, NoEndpointSelected } from "@/components/playground/ExplorerContent";

export const revalidate = false;

export default async function ExplorerPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug: slugProp } = await params;

    if (slugProp.endsWith(".js")) {
        console.debug(`[static-explorer] returning early not found for ${slugProp}`);
        return null;
    }

    const slug = FernNavigation.slugjoin(slugProp);

    const loader = await createCachedDocsLoader(host, domain);

    // Check for configured redirects FIRST (configured redirects take precedence)
    const [config, baseUrl] = await Promise.all([loader.getConfig(), loader.getMetadata()]);
    const configuredRedirect = getRedirectForPath(slugToHref(slug), baseUrl, config.redirects);
    if (configuredRedirect != null) {
        const redirectFn = configuredRedirect.permanent ? permanentRedirect : redirect;
        redirectFn(prepareRedirect(configuredRedirect.destination));
    }

    const root = await loader.getRoot();

    const found = FernNavigation.utils.findNode(root, slug);
    if (found.type !== "found") {
        console.debug("Did not find node for slug", slug);
        if (found.redirect) {
            console.debug(`[${domain}] Redirecting to "${found.redirect}" in static page`);
            // this will allow us to redirect to the correct page in the same intercepted API Explorer page
            redirect(conformTrailingSlash(conformExplorerRoute(found.redirect)), RedirectType.replace);
        }

        return <NoEndpointSelected />;
    }
    const node = found.node;

    return <ExplorerContent loader={loader} node={node} />;
}
