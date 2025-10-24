import { PrefetchedDocsLoader } from "@fern-api/docs-loader";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import {
    type ClientPageDataDependencies,
    constructEditorSlug,
    getClientPageDefaultFilename,
    getEditorRedirectSlug,
    getSerializableFoundNode,
    ROOT_SLUG_ALIAS
} from "@fern-docs/components/navigation";
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
    const root = await loader.getRoot();

    // If requested slug == ROOT_SLUG_ALIAS ("root"), use slug from the root node instead
    const navigationSlug = requestedSlug === ROOT_SLUG_ALIAS ? root.slug : requestedSlug;
    const navigationNode = FernNavigation.utils.findNode(root, navigationSlug);

    // Handle notFound case first - treat as potential client page instead of redirecting
    if (navigationNode.type === "notFound") {
        // Instead of redirecting to root, treat this as a potential client page
        // The client will resolve it from the NavigationStore if it exists
        const pageDataDeps: ClientPageDataDependencies = {
            source: "client",
            filename: getClientPageDefaultFilename(navigationSlug)
        };

        return (
            <PageSidebar
                prefetchedLoaderData={prefetchedLoaderData}
                pageDataDeps={pageDataDeps}
                serializableRootNode={root}
            />
        );
    }

    // Check if we need to redirect using the shared utility function
    const redirectSlug = getEditorRedirectSlug({ navigationNode, navigationSlug, root });

    if (redirectSlug != null) {
        const redirectUrl = constructEditorSlug({
            orgName,
            docsUrl,
            branchName: branch,
            slug: redirectSlug
        });
        return <EditorRedirect redirectUrl={redirectUrl} />;
    }

    // Redirect should have been handled by the getEditorRedirectSlug, throw an error if it wasn't
    if (navigationNode.type === "redirect") {
        throw new Error("navigationNode of type 'redirect' should be handled by EditorRedirect");
    }

    // Get a serializable copy of the found node to be passed over the wire to PageSidebar
    const serializableFoundNode = getSerializableFoundNode(navigationNode);

    // This is a server page, get the page id and fetch data from the loader
    const pageId = getPageId(serializableFoundNode.node);
    const page = pageId ? await loader.getPage(pageId) : undefined;

    // If the page is not found, set pageDataDeps to undefined so that the fallbackFoundNode is used
    // This is used for api reference pages, and other non-page nodes
    let pageDataDeps: PageNodeNamespace.Props["pageDataDeps"] | undefined;
    if (page == null) {
        pageDataDeps = undefined;
    } else {
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
            serializableRootNode={root}
        />
    );
}
