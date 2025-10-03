import "server-only";

import { RedirectType, redirect } from "next/navigation";
import React from "react";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { conformTrailingSlash } from "@fern-api/docs-utils";
import { conformExplorerRoute } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";

import { getFernToken } from "@/app/fern-token";
import { ExplorerContent, NoEndpointSelected } from "@/components/playground/ExplorerContent";

export default async function ExplorerPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug: slugProp } = await params;

    if (slugProp.endsWith(".js")) {
        console.debug(`[dynamic-explorer] returning early not found for ${slugProp}`);
        return null;
    }

    const slug = FernNavigation.slugjoin(slugProp);

    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const root = await loader.getRoot();

    const found = FernNavigation.utils.findNode(root, slug);
    if (found.type !== "found") {
        console.debug("Did not find node for slug", slug);
        if (found.redirect) {
            console.debug(`[${domain}] Redirecting to "${found.redirect}" in dynamic page`);
            // this will allow us to redirect to the correct page in the same intercepted API Explorer page
            redirect(conformTrailingSlash(conformExplorerRoute(found.redirect)), RedirectType.replace);
        }

        return <NoEndpointSelected />;
    }
    const node = found.node;

    return <ExplorerContent loader={loader} node={node} />;
}
