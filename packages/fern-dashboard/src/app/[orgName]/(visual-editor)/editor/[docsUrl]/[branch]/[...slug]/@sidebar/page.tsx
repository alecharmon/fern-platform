import { PrefetchedDocsLoader } from "@fern-api/docs-loader";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import {
    constructEditorSlug,
    getClientPageDefaultFilename,
    getEditorRedirectSlug,
    getSerializableFoundNode,
    ROOT_SLUG_ALIAS,
    type SerializableFoundNode
} from "@fern-docs/components/navigation";
import { notFound } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";
import { EditorRedirect } from "../EditorRedirect";
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

    let pageDataDeps: PageNodeNamespace.Props["pageDataDeps"];
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

        // Check if we need to redirect using the shared utility function
        const redirectSlug = getEditorRedirectSlug({ navigationNode, navigationSlug, root });

        if (redirectSlug != null) {
            const redirectUrl = constructEditorSlug({
                orgName,
                docsUrl,
                branchName: branch,
                slug: redirectSlug
            });
            // Return client component that redirects (to keep in sync, should be same as ../page.tsx)
            return <EditorRedirect redirectUrl={redirectUrl} />;
        }

        // Redirect should have been handled by the getEditorRedirectSlug, throw an error if it wasn't
        if (navigationNode.type === "redirect") {
            throw new Error("navigationNode of type 'redirect' should be handled by EditorRedirect");
        }

        // If getEditorRedirectSlug returns null for a notFound node at root, we should 404
        if (navigationNode.type === "notFound") {
            notFound();
        }

        // Get a serializable copy of the found node to be passed over the wire to PageSidebar
        serializableFoundNode = getSerializableFoundNode(navigationNode);

        // This is a server page, get the page id and fetch data from the loader
        const pageId = getPageId(serializableFoundNode.node);
        const page = pageId ? await loader.getPage(pageId) : undefined;

        if (page == null) {
            throw new Error(`Could not find page with ID ${pageId}`);
        }

        // TODO: if rawMarkdown is not available, show a warning to the user that they need to upgrade their CLI version
        const rawMarkdown = page.rawMarkdown ?? page.markdown;

        pageDataDeps = {
            source: "server",
            filename: page.filename,
            initialMdx: rawMarkdown,
            initialFoundNode: serializableFoundNode
        };
    }

    return (
        <PageSidebar
            prefetchedLoaderData={prefetchedLoaderData}
            pageDataDeps={pageDataDeps}
            fallbackFoundNode={serializableFoundNode}
        />
    );
}
