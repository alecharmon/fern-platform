import "server-only";

import { createPruneKey } from "@fern-api/docs-loader";
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
import { assertAuthAndFetchGithubUrl } from "@/app/services/dal/github/assertAuthAndFetchGithubUrl";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import ChangelogComingSoon from "@/components/editor/unsupported-pages/ChangelogComingSoon";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { EncodedDocsUrl } from "@/utils/types";
import { cn } from "@/utils/utils";
import { ApiEndpointPageWrapper } from "./ApiEndpointPageWrapper";
import { ApiGrpcPageWrapper } from "./ApiGrpcPageWrapper";
import { ApiWebhookPageWrapper } from "./ApiWebhookPageWrapper";
import { ApiWebSocketPageWrapper } from "./ApiWebSocketPageWrapper";
import { EditorRedirect } from "./EditorRedirect";
import PageNode, { type PageNode as PageNodeNamespace } from "./PageNode";

const CHANGELOG_NODE_TYPES = new Set(["changelog", "changelogEntry"]);

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

    const { session } = await assertAuthAndFetchGithubUrl(orgName, parseDocsUrlParam({ docsUrl }));

    // Session should always be defined at this point
    if (session == null) {
        return null;
    }

    // Use cached loader - this will reuse the loader created in layout.tsx
    const loader = await getCachedEditableDocsLoader(host, docsUrl, session.accessToken, branch);

    const [root, theme] = await Promise.all([loader.getRoot(), loader.getTheme()]);
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
            <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={{}} lang="en" theme={theme}>
                <div className="flex w-full flex-col gap-2 py-12">
                    <PageNode pageDataDeps={pageDataDeps} fallbackFoundNode={undefined} serializableRootNode={root} />
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

    // Handle API reference node types - render full API reference pages
    // Note: We don't wrap these in AbstractLayoutEvaluatorContent because they
    // provide their own ReferenceLayout which handles full-width styling
    if (navigationNode.node.type === "endpoint") {
        const endpointNode = navigationNode.node as FernNavigation.EndpointNode;
        const apiDefinition = await loader.getPrunedApi(endpointNode.apiDefinitionId, createPruneKey(endpointNode));

        return (
            <ApiEndpointPageWrapper
                node={endpointNode}
                apiDefinition={apiDefinition}
                breadcrumb={navigationNode.breadcrumb}
                theme={theme}
            />
        );
    }

    if (navigationNode.node.type === "webSocket") {
        const webSocketNode = navigationNode.node as FernNavigation.WebSocketNode;
        const apiDefinition = await loader.getPrunedApi(webSocketNode.apiDefinitionId, createPruneKey(webSocketNode));

        return (
            <ApiWebSocketPageWrapper
                node={webSocketNode}
                apiDefinition={apiDefinition}
                breadcrumb={navigationNode.breadcrumb}
                theme={theme}
            />
        );
    }

    if (navigationNode.node.type === "webhook") {
        const webhookNode = navigationNode.node as FernNavigation.WebhookNode;
        const apiDefinition = await loader.getPrunedApi(webhookNode.apiDefinitionId, createPruneKey(webhookNode));

        return (
            <ApiWebhookPageWrapper
                node={webhookNode}
                apiDefinition={apiDefinition}
                breadcrumb={navigationNode.breadcrumb}
                theme={theme}
            />
        );
    }

    if (navigationNode.node.type === "grpc") {
        const grpcNode = navigationNode.node as FernNavigation.GrpcNode;
        const apiDefinition = await loader.getPrunedApi(grpcNode.apiDefinitionId, createPruneKey(grpcNode));

        return (
            <ApiGrpcPageWrapper
                node={grpcNode}
                apiDefinition={apiDefinition}
                breadcrumb={navigationNode.breadcrumb}
                theme={theme}
            />
        );
    }

    // apiPackage nodes with overviewPageId will fall through to the page rendering logic below.
    // apiPackage nodes without overviewPageId should redirect (handled by getEditorRedirectSlug above).

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

    return (
        // TODO: Currently, we are force-hiding the table of contents is within Fern Editor.
        // This is a temporary solution, as I anticipate we will want the TOC to be dynamic based
        // on the tiptap editor's content.
        <AbstractLayoutEvaluatorContent tableOfContents={[]} frontmatter={frontmatter} lang="en" theme={theme}>
            <div className={cn("flex w-full flex-col gap-2 py-12", frontmatter?.layout === "custom" && "py-10")}>
                <PageNode
                    pageDataDeps={pageDataDeps}
                    fallbackFoundNode={serializableFoundNode}
                    serializableRootNode={root}
                />
            </div>
        </AbstractLayoutEvaluatorContent>
    );
}
