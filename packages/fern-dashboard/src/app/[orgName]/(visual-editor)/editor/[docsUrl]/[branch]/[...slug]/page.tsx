import "server-only";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import {
    constructEditorSlug,
    getClientPageDefaultFilename,
    getEditorRedirectSlug,
    getSerializableFoundNode,
    ROOT_SLUG_ALIAS,
    type SerializableFoundNode
} from "@fern-docs/components/navigation";
import { getFrontmatter } from "@fern-docs/mdx";
import { notFound } from "next/navigation";

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

    let pageDataDeps: PageNodeNamespace.Props["pageDataDeps"];
    let serializableFoundNode: SerializableFoundNode | undefined;

    let frontmatter: ReturnType<typeof getFrontmatter>["data"] | undefined;
    let cssConfig: PageNodeNamespace.Props["cssConfig"];

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
            // Return client component that redirects (to keep in sync, should be same as ./@sidebar/page.tsx)
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

        // Get a serializable copy of the found node to be passed over the wire to PageNode
        serializableFoundNode = getSerializableFoundNode(navigationNode);

        // This is a server page, get the page id and fetch data from the loader
        const pageId = getPageId(serializableFoundNode.node);
        const page = pageId ? await loader.getPage(pageId) : undefined;

        if (page == null) {
            throw new Error(`Could not find page with ID ${pageId}`);
        }

        // TODO: if rawMarkdown is not available, show a warning to the user that they need to upgrade their CLI version
        const rawMarkdown = page.rawMarkdown ?? page.markdown;

        // Extract frontmatter from the markdown
        frontmatter = getFrontmatter(rawMarkdown).data;

        pageDataDeps = {
            source: "server",
            filename: page.filename,
            initialMdx: rawMarkdown,
            initialFoundNode: serializableFoundNode
        };
        cssConfig = page.css;
    }

    return (
        // TODO: Currently, we are force-hiding the table of contents is within Fern Editor.
        // This is a temporary solution, as I anticipate we will want the TOC to be dynamic based
        // on the tiptap editor's content.
        <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={frontmatter}>
            <div className={cn("flex w-full flex-col gap-2 py-12", frontmatter?.layout === "custom" && "py-10")}>
                <PageNode pageDataDeps={pageDataDeps} fallbackFoundNode={serializableFoundNode} cssConfig={cssConfig} />
            </div>
        </AbstractLayoutEvaluatorContent>
    );
}
