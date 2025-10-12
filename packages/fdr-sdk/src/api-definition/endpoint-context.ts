import type { EndpointNode, GrpcNode, TypeId, WebhookNode, WebSocketNode } from "../navigation";
import type {
    ApiDefinition,
    AuthScheme,
    EndpointDefinition,
    EndpointId,
    ObjectProperty,
    TypeDefinition,
    WebhookDefinition,
    WebSocketChannel
} from "./latest";
import { prune } from "./prune";

export type EndpointContext = {
    node: EndpointNode;
    endpoint: EndpointDefinition;
    globalHeaders: ObjectProperty[];
    auths: AuthScheme[];
    types: Record<TypeId, TypeDefinition>;
};

export function createEndpointContext(
    node: EndpointNode | undefined,
    apiDefinition: ApiDefinition | undefined
): EndpointContext | undefined {
    if (!node) {
        return undefined;
    }
    const api = apiDefinition != null ? prune(apiDefinition, node) : undefined;
    const endpoint = api?.endpoints[node.endpointId];
    if (!endpoint) {
        return undefined;
    }
    return {
        node,
        endpoint,
        auths: endpoint.auth?.map((id) => api.auths[id]).filter((auth): auth is AuthScheme => auth != null) ?? [],
        globalHeaders: api.globalHeaders ?? [],
        types: api.types
    };
}

export type WebSocketContext = {
    node: WebSocketNode;
    channel: WebSocketChannel;
    globalHeaders: ObjectProperty[];
    auths: AuthScheme[];
    types: Record<TypeId, TypeDefinition>;
};

export function createWebSocketContext(
    node: WebSocketNode | undefined,
    apiDefinition: ApiDefinition | undefined
): WebSocketContext | undefined {
    if (!node) {
        return undefined;
    }
    const api = apiDefinition != null ? prune(apiDefinition, node) : undefined;
    const channel = api?.websockets[node.webSocketId];
    if (!channel) {
        return undefined;
    }
    return {
        node,
        channel,
        auths: channel.auth?.map((id) => api.auths[id]).filter((auth): auth is AuthScheme => auth != null) ?? [],
        globalHeaders: api.globalHeaders ?? [],
        types: api.types
    };
}

export type WebhookContext = {
    node: WebhookNode;
    webhook: WebhookDefinition;
    types: Record<TypeId, TypeDefinition>;
};

export function createWebhookContext(
    node: WebhookNode | undefined,
    apiDefinition: ApiDefinition | undefined
): WebhookContext | undefined {
    if (!node) {
        return undefined;
    }
    const api = apiDefinition != null ? prune(apiDefinition, node) : undefined;
    const webhook = api?.webhooks[node.webhookId];
    if (!webhook) {
        return undefined;
    }
    return {
        node,
        webhook,
        types: api.types
    };
}

export type GrpcContext = {
    node: GrpcNode;
    grpc: EndpointDefinition;
    types: Record<TypeId, TypeDefinition>;
};

export function createGrpcContext(
    node: GrpcNode | undefined,
    apiDefinition: ApiDefinition | undefined
): GrpcContext | undefined {
    if (!node) {
        return undefined;
    }
    const api = apiDefinition != null ? prune(apiDefinition, node) : undefined;
    const grpc = api?.endpoints[node.grpcId as unknown as EndpointId];
    if (!grpc) {
        return undefined;
    }
    return {
        node,
        grpc,
        types: api.types
    };
}
