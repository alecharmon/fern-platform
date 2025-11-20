import "server-only";

import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { getPageId, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { AbstractLayoutEvaluatorContent } from "@fern-docs/components/layouts/AbstractLayoutEvaluatorContent";
import {
    constructEditorSlug,
    getEditorRedirectSlug,
    getRootAliasAwareNavigationSlug,
    getSerializableFoundNode
} from "@fern-docs/components/navigation";
import { getFrontmatter } from "@fern-docs/mdx";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertAuthAndFetchGitUrl } from "@/app/services/dal/git/assertAuthAndFetchGitUrl";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import ApiReferenceComingSoon from "@/components/editor/unsupported-pages/ApiReferenceComingSoon";
import ChangelogComingSoon from "@/components/editor/unsupported-pages/ChangelogComingSoon";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";
import { EditorRedirect } from "./EditorRedirect";
import PageNode, { type PageNode as PageNodeNamespace } from "./PageNode";

const CHANGELOG_NODE_TYPES = new Set(["changelog", "changelogEntry"]);
const API_REFERENCE_NODE_TYPES = new Set(["apiReference", "apiPackage", "endpoint", "webSocket", "webhook", "grpc"]);

export default async function Page({
    params
}: {
    params: Promise<{
        orgName: Auth0OrgName;
        docsUrl: EncodedDocsUrl;
        branch: string;
        slug: string[];
    }>;
}) {
    const { orgName, docsUrl, branch, slug } = await params;
    const host = await getHostFromHeaders();

    const { session } = await assertAuthAndFetchGitUrl(orgName, parseDocsUrlParam({ docsUrl }));

    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader(host, docsUrl, session.accessToken, branch);

    const root = await loader.getRoot();
    const navigationSlug = getRootAliasAwareNavigationSlug(slugjoin(slug), root);
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
            <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={{}} lang="en">
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

    if (API_REFERENCE_NODE_TYPES.has(navigationNode.node.type)) {
        return <ApiReferenceComingSoon />;
    }
    if (CHANGELOG_NODE_TYPES.has(navigationNode.node.type)) {
        return <ChangelogComingSoon />;
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
        <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={frontmatter} lang="en">
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
