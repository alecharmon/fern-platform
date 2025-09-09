import "server-only";

import { DocsLoader, createPruneKey } from "@fern-api/docs-loader";
import {
  ApiDefinition,
  createEndpointContext,
  createGrpcContext,
  createWebSocketContext,
  createWebhookContext,
  prune,
} from "@fern-api/fdr-sdk/api-definition";
import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";

import { MdxSerializer } from "@/server/mdx-serializer";

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
  bottomNavigation,
}: {
  loader: DocsLoader;
  serialize: MdxSerializer;
  node: FernNavigation.NavigationNodeApiLeaf;
  action?: React.ReactNode;
  breadcrumb: readonly FernNavigation.BreadcrumbItem[];
  bottomNavigation?: React.ReactNode;
}) {
  const apiDefinition = await loader.getPrunedApi(
    node.apiDefinitionId,
    createPruneKey(node)
  );

  const configLayout = await loader.getLayout();

  return (
    <ApiEndpointContent
      serialize={serialize}
      node={node}
      apiDefinition={apiDefinition}
      breadcrumb={breadcrumb}
      bottomNavigation={
        configLayout.hideNavLinks ? undefined : bottomNavigation
      }
      action={action}
      hideFeedback={configLayout.hideFeedback}
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
}: {
  serialize: MdxSerializer;
  node: FernNavigation.NavigationNodeApiLeaf;
  action?: React.ReactNode;
  apiDefinition: ApiDefinition;
  breadcrumb: readonly FernNavigation.BreadcrumbItem[];
  bottomNavigation?: React.ReactNode;
  hideFeedback: boolean;
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
        />
      );
    }

    default:
      return null;
  }
}
