import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import {
    conformExplorerRoute,
    conformTrailingSlash,
    decodeAuthContextFromParams,
    getRedirectForPath,
    prepareRedirect,
    slugToHref
} from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { permanentRedirect, RedirectType, redirect } from "next/navigation";
import { Suspense } from "react";

import { ExplorerContent, NoEndpointSelected } from "@/components/playground/ExplorerContent";
import { PlaygroundEndpointSkeleton } from "@/components/playground/endpoint";

export const revalidate = false;

export default async function ExplorerPage({
    params
}: {
    params: Promise<{
        host: string;
        domain: string;
        requiresLogin: string;
        isLoggedIn: string;
        roles: string;
        slug: string;
    }>;
}) {
    const { host, domain, slug: slugProp, ...authParams } = await params;

    if (slugProp.endsWith(".js")) {
        console.debug(`[roles-explorer] returning early not found for ${slugProp}`);
        return null;
    }

    const slug = FernNavigation.slugjoin(slugProp);
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);

    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });

    const [config, baseUrl] = await Promise.all([loader.getConfig(), loader.getMetadata()]);

    const configuredRedirect = getRedirectForPath(slugToHref(slug), baseUrl, config.redirects);

    if (configuredRedirect != null) {
        const redirectFn = configuredRedirect.permanent ? permanentRedirect : redirect;
        redirectFn(prepareRedirect(configuredRedirect.destination));
    }

    const root = await loader.getRoot();

    const found = FernNavigation.utils.findNode(root, slug);
    const lang = await loader.getLanguage();

    if (found.type !== "found") {
        if (found.redirect) {
            redirect(conformTrailingSlash(conformExplorerRoute(found.redirect)), RedirectType.replace);
        }

        return <NoEndpointSelected lang={lang} />;
    }
    const node = found.node;

    return (
        <Suspense fallback={<PlaygroundEndpointSkeleton />}>
            <ExplorerContent loader={loader} node={node} lang={lang} />
        </Suspense>
    );
}
