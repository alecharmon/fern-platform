import "server-only";

import { createPruneKey } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import {
    type ApiDefinition,
    createEndpointContext,
    createGraphqlContext,
    createGrpcContext,
    createWebhookContext,
    createWebSocketContext,
    prune
} from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import type { FernDropdown } from "@fern-docs/components/FernDropdown";

import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { constructPageOptions } from "../PageActionsOptions";
import { EndpointContent } from "./endpoints/EndpointContent";
import { GraphqlContent } from "./graphql/GraphqlContent";
import { GrpcContent } from "./grpcs/GrpcContent";
import { WebhookContent } from "./webhooks/WebhookContent";
import { WebSocketContent } from "./websockets/WebSocket";

export default async function ApiEndpointPage({
    loader,
    serialize,
    node,
    action,
    breadcrumb,
    bottomNavigation,
    lang,
    showUnionsAsDropdown = false
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    node: FernNavigation.NavigationNodeApiLeaf;
    action?: React.ReactNode;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation?: React.ReactNode;
    lang: string;
    showUnionsAsDropdown?: boolean;
}) {
    const apiDefinition = await loader.getPrunedApi(node.apiDefinitionId, createPruneKey(node));

    const config = await loader.getConfig();
    const layout = await loader.getLayout();
    const files = await loader.getFiles();
    const theme = await loader.getTheme();
    const metadata = await loader.getMetadata();
    const pageActionOptions = await constructPageOptions({
        pageActionConfig: config,
        domain: loader.domain,
        slug: node.slug,
        lang,
        files,
        basePath: metadata.basePath
    });

    const markdownPromise = getMarkdownForPath(node, loader, loader.domain);
    const pageActionsStyle = config.theme?.["page-actions"] ?? "default";

    return (
        <ApiEndpointContent
            serialize={serialize}
            node={node}
            apiDefinition={apiDefinition}
            breadcrumb={breadcrumb}
            bottomNavigation={layout.hideNavLinks ? undefined : bottomNavigation}
            action={action}
            hideFeedback={layout.hideFeedback}
            pageActionOptions={pageActionOptions}
            markdownPromise={markdownPromise}
            lang={lang}
            pageActionsStyle={pageActionsStyle}
            theme={theme}
            showUnionsAsDropdown={showUnionsAsDropdown}
        />
    );
}

async function ApiEndpointContent({
    serialize,
    node,
    action,
    apiDefinition,
    breadcrumb,
    bottomNavigation,
    hideFeedback,
    pageActionOptions,
    markdownPromise,
    lang,
    pageActionsStyle,
    theme,
    showUnionsAsDropdown = false
}: {
    serialize: MdxSerializer;
    node: FernNavigation.NavigationNodeApiLeaf;
    action?: React.ReactNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdownPromise: Promise<{ content: string; contentType: "markdown" | "mdx" } | undefined>;
    lang: string;
    pageActionsStyle: "default" | "toolbar";
    theme?: FernThemeConfig;
    showUnionsAsDropdown?: boolean;
}) {
    switch (node.type) {
        case "endpoint": {
            const context = createEndpointContext(node, prune(apiDefinition, node));
            if (!context) {
                throw new Error(`Could not create endpoint context for ${node.id}`);
            }
            return (
                <EndpointContent
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    context={context}
                    action={action}
                    showErrors
                    bottomNavigation={bottomNavigation}
                    showAuth
                    hideFeedback={hideFeedback}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                    theme={theme}
                    showUnionsAsDropdown={showUnionsAsDropdown}
                />
            );
        }
        case "webSocket": {
            const context = createWebSocketContext(node, prune(apiDefinition, node));
            if (!context) {
                throw new Error(`Could not create web socket context for ${node.id}`);
            }
            return (
                <WebSocketContent
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    context={context}
                    action={action}
                    bottomNavigation={bottomNavigation}
                    hideFeedback={hideFeedback}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                    theme={theme}
                    showUnionsAsDropdown={showUnionsAsDropdown}
                />
            );
        }
        case "webhook": {
            const context = createWebhookContext(node, prune(apiDefinition, node));
            if (!context) {
                throw new Error(`Could not create web hook context for ${node.id}`);
            }
            return (
                <WebhookContent
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    context={context}
                    action={action}
                    bottomNavigation={bottomNavigation}
                    hideFeedback={hideFeedback}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                    theme={theme}
                    showUnionsAsDropdown={showUnionsAsDropdown}
                />
            );
        }
        case "grpc": {
            const context = createGrpcContext(node, prune(apiDefinition, node));
            if (!context) {
                throw new Error(`Could not create grpc context for ${node.id}`);
            }
            return (
                <GrpcContent
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    context={context}
                    action={action}
                    bottomNavigation={bottomNavigation}
                    hideFeedback={hideFeedback}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                    theme={theme}
                    showUnionsAsDropdown={showUnionsAsDropdown}
                />
            );
        }
        case "graphql": {
            const context = createGraphqlContext(node, prune(apiDefinition, node));
            if (!context) {
                throw new Error(`Could not create graphql context for ${node.id}`);
            }
            return (
                <GraphqlContent
                    serialize={serialize}
                    breadcrumb={breadcrumb}
                    context={context}
                    action={action}
                    bottomNavigation={bottomNavigation}
                    hideFeedback={hideFeedback}
                    pageActionOptions={pageActionOptions}
                    markdownPromise={markdownPromise}
                    lang={lang}
                    pageActionsStyle={pageActionsStyle}
                    theme={theme}
                    showUnionsAsDropdown={showUnionsAsDropdown}
                />
            );
        }

        default:
            return null;
    }
}
