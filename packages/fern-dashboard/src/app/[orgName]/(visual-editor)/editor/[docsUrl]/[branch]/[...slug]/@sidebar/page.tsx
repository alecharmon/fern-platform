import { PrefetchedDocsLoader } from "@fern-api/docs-loader";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import {
    constructEditorSlug,
    getClientPageDefaultFilename,
    getSerializableFoundNode,
    ROOT_SLUG_ALIAS,
    type SerializableFoundNode
} from "@fern-docs/components/navigation";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

import type { PageNode as PageNodeNamespace } from "../PageNode";
import PageSidebar from "./PageSidebar";

export default async function SidebarPage({
    params,
    searchParams
}: {
    params: Promise<{
        orgName: Auth0OrgName;
        docsUrl: EncodedDocsUrl;
        slug: string[];
        branch: string;
    }>;
    searchParams: Promise<Record<string, string>>;
}) {
    const { orgName, docsUrl, branch, slug } = await params;
    const resolvedSearchParams = await searchParams;
    const session = await getCurrentSession();
    const host = await getHostFromHeaders();
    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader({
        host,
        encodedDocsUrl: docsUrl,
        fernToken: session?.accessToken,
        branchName: branch
    });
    const [config, authState, edgeFlags, layout] = await Promise.all([
        loader.getConfig(),
        loader.getAuthState(),
        loader.getEdgeFlags(),
        loader.getLayout()
    ]);
    const prefetchedLoaderData = new PrefetchedDocsLoader({
        domain: loader.domain,
        config,
        authState,
        edgeFlags,
        layout
    }).serializable();

    const requestedSlug = slugjoin(slug);

    let pageDataDeps: PageNodeNamespace.Props["pageDataDeps"] | undefined;
    let serializableFoundNode: SerializableFoundNode | undefined;

    if (resolvedSearchParams["client-page"]) {
        pageDataDeps = {
            source: "client",
            filename: getClientPageDefaultFilename(requestedSlug)
        };
    } else {
        const root = await loader.getRoot();

        // If requested slug == ROOT_SLUG_ALIAS ("root"), use slug from the root node instead
        const navigationSlug = requestedSlug === ROOT_SLUG_ALIAS ? root.slug : requestedSlug;
        const navigationNode = FernNavigation.utils.findNode(root, navigationSlug);

        if (navigationNode.type === "notFound") {
            // Throw 404 to prevent infinite redirect loop
            // NOTE: the root slug is not always the root page
            // e.g. elevenlabs' root slug == "/docs", but root page is "/docs/overview"
            if (navigationSlug === root.slug) {
                notFound();
            }
            return redirect(
                constructEditorSlug({
                    orgName,
                    docsUrl,
                    branchName: branch,
                    slug: ROOT_SLUG_ALIAS
                })
            );
        }

        // Redirect to redirect target if specified
        if (navigationNode.type === "redirect") {
            return redirect(
                constructEditorSlug({
                    orgName,
                    docsUrl,
                    branchName: branch,
                    slug: navigationNode.redirect
                })
            );
        }

        // Get a serializable copy of the found node to be passed over the wire to PageNode
        serializableFoundNode = getSerializableFoundNode(navigationNode);

        // This is a server page, get the page id and fetch data from the loader
        const pageId = getPageId(serializableFoundNode.node);
        const page = pageId ? await loader.getPage(pageId) : undefined;

        if (page) {
            // TODO: if rawMarkdown is not available, show a warning to the user that they need to upgrade their CLI version
            const rawMarkdown = page.rawMarkdown ?? page.markdown;

            pageDataDeps = {
                source: "server",
                filename: page.filename,
                initialMdx: rawMarkdown,
                initialFoundNode: serializableFoundNode
            };
        }
    }

    return (
        <PageSidebar
            prefetchedLoaderData={prefetchedLoaderData}
            pageDataDeps={pageDataDeps}
            fallbackFoundNode={serializableFoundNode}
        />
    );
}
