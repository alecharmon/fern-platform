import "server-only";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import {
    constructEditorSlug,
    getClientPageDefaultFilename,
    getSerializableFoundNode,
    ROOT_SLUG_ALIAS,
    type SerializableFoundNode
} from "@fern-docs/components/navigation";
import { notFound, redirect } from "next/navigation";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";

import PageNode, { type PageNode as PageNodeNamespace } from "./PageNode";

export const experimental_ppr = true;

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
        let pageId = getPageId(serializableFoundNode.node);

        // If the found node doesn't have a pageId (e.g., section without overviewPageId),
        // find the first page within it
        if (!pageId && navigationNode.node.type === "section") {
            // Helper function to recursively find the first page node
            function findFirstPageNode(
                node: FernNavigation.NavigationNodePage | FernNavigation.NavigationChild
            ): FernNavigation.NavigationNodePage | undefined {
                if (FernNavigation.isPage(node)) {
                    return node;
                }
                if (node.type === "section" && node.children && node.children.length > 0) {
                    for (const child of node.children) {
                        const foundPageNode = findFirstPageNode(child);
                        if (foundPageNode) {
                            return foundPageNode;
                        }
                    }
                }
                return undefined;
            }
            const firstPageNode = findFirstPageNode(navigationNode.node);
            if (firstPageNode) {
                pageId = getPageId(firstPageNode);
                const foundNode = FernNavigation.utils.findNode(root, firstPageNode.slug);
                if (foundNode.type === "found") {
                    serializableFoundNode = getSerializableFoundNode(foundNode);
                }
            }
        }

        const page = pageId ? await loader.getPage(pageId) : undefined;

        if (page == null) {
            throw new Error(`Could not find page with ID ${pageId}`);
        }

        const rawMarkdown = page.rawMarkdown ?? page.markdown;

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
        <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={undefined}>
            <div className="flex w-full flex-col gap-2 py-12">
                <PageNode pageDataDeps={pageDataDeps} fallbackFoundNode={serializableFoundNode} cssConfig={cssConfig} />
            </div>
        </AbstractLayoutEvaluatorContent>
    );
}
