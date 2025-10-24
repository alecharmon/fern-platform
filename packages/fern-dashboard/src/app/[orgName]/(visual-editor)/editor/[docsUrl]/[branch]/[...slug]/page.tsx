import "server-only";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import {
    constructEditorSlug,
    getEditorRedirectSlug,
    getSerializableFoundNode,
    ROOT_SLUG_ALIAS
} from "@fern-docs/components/navigation";
import { getFrontmatter } from "@fern-docs/mdx";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";
import { EditorRedirect } from "./EditorRedirect";
import PageNode, { type PageNode as PageNodeNamespace } from "./PageNode";

export default async function Page({
    params,
    searchParams
}: {
    params: Promise<{
        orgName: Auth0OrgName;
        docsUrl: EncodedDocsUrl;
        branch: string;
        slug: string[];
    }>;
    searchParams: Promise<Record<string, string>>;
}) {
    const { orgName, docsUrl, branch, slug } = await params;
    const [resolvedSearchParams, host] = await Promise.all([searchParams, getHostFromHeaders()]);

    const { githubUrl, session } = await assertAuthAndFetchGithubUrl({
        orgName,
        docsUrl: parseDocsUrlParam({ docsUrl })
    });

    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader({
        host,
        encodedDocsUrl: docsUrl,
        fernToken: session.accessToken,
        githubUrl,
        branchName: branch
    });

    const requestedSlug = slugjoin(slug);
    const root = await loader.getRoot();

    // If requested slug == ROOT_SLUG_ALIAS ("root"), use slug from the root node instead
    const navigationSlug = requestedSlug === ROOT_SLUG_ALIAS ? root.slug : requestedSlug;
    const navigationNode = FernNavigation.utils.findNode(root, navigationSlug);

    // Handle notFound case first - treat as potential client page instead of redirecting
    if (navigationNode.type === "notFound") {
        // Instead of redirecting to root, treat this as a potential client page
        // The client will resolve it from the NavigationStore if it exists
        const pageDataDeps: PageNodeNamespace.Props["pageDataDeps"] = {
            source: "client",
            filename: `docs/pages/${navigationSlug}.mdx`
        };

        return (
            <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={{}}>
                <div className="flex w-full flex-col gap-2 py-12">
                    <PageNode
                        pageDataDeps={pageDataDeps}
                        fallbackFoundNode={undefined}
                        cssConfig={undefined}
                        serializableRootNode={root}
                    />
                </div>
            </AbstractLayoutEvaluatorContent>
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

    // Get a serializable copy of the found node to be passed over the wire to PageNode
    const serializableFoundNode = getSerializableFoundNode(navigationNode);

    // This is a server page, get the page id and fetch data from the loader
    const pageId = getPageId(serializableFoundNode.node);
    const page = pageId ? await loader.getPage(pageId) : undefined;

    if (page == null) {
        throw new Error(`Could not find page with ID ${pageId}`);
    }

    // TODO: if rawMarkdown is not available, show a warning to the user that they need to upgrade their CLI version
    const rawMarkdown = page.rawMarkdown ?? page.markdown;

    // Extract frontmatter from the markdown
    const frontmatter = getFrontmatter(rawMarkdown).data;

    const pageDataDeps: PageNodeNamespace.Props["pageDataDeps"] = {
        source: "server",
        filename: page.filename,
        initialMdx: rawMarkdown,
        initialFoundNode: serializableFoundNode
    };
    const cssConfig = page.css;

    return (
        // TODO: Currently, we are force-hiding the table of contents is within Fern Editor.
        // This is a temporary solution, as I anticipate we will want the TOC to be dynamic based
        // on the tiptap editor's content.
        <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={frontmatter}>
            <div className={cn("flex w-full flex-col gap-2 py-12", frontmatter?.layout === "custom" && "py-10")}>
                <PageNode
                    pageDataDeps={pageDataDeps}
                    fallbackFoundNode={serializableFoundNode}
                    cssConfig={cssConfig}
                    serializableRootNode={root}
                />
            </div>
        </AbstractLayoutEvaluatorContent>
    );
}
