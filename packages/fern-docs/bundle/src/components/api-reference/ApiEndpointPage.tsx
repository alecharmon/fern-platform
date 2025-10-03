import "server-only";

import { createPruneKey } from "@fern-api/docs-loader";
import { DocsLoader } from "@fern-api/docs-server/docs-loader";
import {
    ApiDefinition,
    createEndpointContext,
    createGrpcContext,
    createWebSocketContext,
    createWebhookContext,
    prune
} from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { FernDropdown } from "@fern-docs/components";

import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import { MdxSerializer } from "@/server/mdx-serializer";

import { constructPageOptions } from "../PageActionsDropdownOptions";
import { EndpointContent } from "./endpoints/EndpointContent";
import { GrpcContent } from "./grpcs/GrpcContent";
import { WebhookContent } from "./webhooks/WebhookContent";
import { WebSocketContent } from "./websockets/WebSocket";

export default async function ApiEndpointPage({
    loader,
    serialize,
    node,
    action,
    breadcrumb,
    bottomNavigation
}: {
    loader: DocsLoader;
    serialize: MdxSerializer;
    node: FernNavigation.NavigationNodeApiLeaf;
    action?: React.ReactNode;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation?: React.ReactNode;
}) {
    const apiDefinition = await loader.getPrunedApi(node.apiDefinitionId, createPruneKey(node));

    const config = await loader.getConfig();
    const layout = await loader.getLayout();
    const pageActionOptions = await constructPageOptions({
        pageActionConfig: config,
        domain: loader.domain,
        slug: node.slug
    });

    const markdown = (await getMarkdownForPath(node, loader, loader.domain))?.content;

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
            markdown={markdown}
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
    markdown
}: {
    serialize: MdxSerializer;
    node: FernNavigation.NavigationNodeApiLeaf;
    action?: React.ReactNode;
    apiDefinition: ApiDefinition;
    breadcrumb: readonly FernNavigation.BreadcrumbItem[];
    bottomNavigation?: React.ReactNode;
    hideFeedback: boolean;
    pageActionOptions?: FernDropdown.PageActionOption[];
    markdown?: string;
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
                    markdown={markdown}
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
                    markdown={markdown}
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
                    markdown={markdown}
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
                    markdown={markdown}
                />
            );
        }

        default:
            return null;
    }
}
