import type { EndpointNode, GraphQlNode, GrpcNode, TypeId, WebhookNode, WebSocketNode } from "../navigation";
import type {
    ApiDefinition,
    AuthScheme,
    AuthSchemeId,
    EndpointDefinition,
    EndpointId,
    GraphQlOperation,
    ObjectProperty,
    TypeDefinition,
    WebhookDefinition,
    WebSocketChannel
} from "./latest";
import { prune } from "./prune";

export type AuthSchemeWithKey = {
    key: AuthSchemeId;
    scheme: AuthScheme;
};

export type AuthOptionEntry = {
    key: string;
    schemeIds: AuthSchemeId[];
    schemes: AuthScheme[];
    label: string;
};

export type EndpointContext = {
    node: EndpointNode;
    endpoint: EndpointDefinition;
    globalHeaders: ObjectProperty[];
    auths: AuthScheme[];
    authsWithKeys: AuthSchemeWithKey[];
    authOptions: AuthScheme[][];
    authOptionEntries: AuthOptionEntry[];
    types: Record<TypeId, TypeDefinition>;
};

function getAuthSchemeLabel(scheme: AuthScheme): string {
    if (scheme.type === "basicAuth") {
        return "Basic Auth";
    }
    if (scheme.type === "bearerAuth") {
        return "Bearer";
    }
    if (scheme.type === "header") {
        return scheme.prefix || "API Key";
    }
    if (scheme.type === "oAuth") {
        return "OAuth";
    }
    return "Auth";
}

function constructAuthOptions(
    endpoint: EndpointDefinition,
    authsMap: Record<AuthSchemeId, AuthScheme>
): AuthScheme[][] {
    if (endpoint.multiAuth != null && endpoint.multiAuth.length > 0) {
        return endpoint.multiAuth
            .map((multiAuthGroup) =>
                multiAuthGroup.schemes
                    .map((schemeId) => authsMap[schemeId])
                    .filter((scheme): scheme is AuthScheme => scheme != null)
            )
            .filter((group) => group.length > 0);
    }

    if (endpoint.auth != null && endpoint.auth.length > 0) {
        return endpoint.auth
            .map((schemeId) => {
                const scheme = authsMap[schemeId];
                return scheme ? [scheme] : null;
            })
            .filter((group): group is AuthScheme[] => group != null);
    }

    return [];
}

function constructAuthOptionEntries(
    endpoint: EndpointDefinition,
    authsMap: Record<AuthSchemeId, AuthScheme>
): AuthOptionEntry[] {
    if (endpoint.multiAuth != null && endpoint.multiAuth.length > 0) {
        return endpoint.multiAuth
            .map((multiAuthGroup) => {
                const schemeIds = multiAuthGroup.schemes;
                const schemes = schemeIds
                    .map((schemeId) => authsMap[schemeId])
                    .filter((scheme): scheme is AuthScheme => scheme != null);

                if (schemes.length === 0) {
                    return null;
                }

                const sortedSchemeIds = [...schemeIds].sort();
                const key = schemes.length === 1 ? String(schemeIds[0]) : `multi:${sortedSchemeIds.join("+")}`;
                const label = schemes.map(getAuthSchemeLabel).join(" + ");

                return {
                    key,
                    schemeIds,
                    schemes,
                    label
                };
            })
            .filter((entry): entry is AuthOptionEntry => entry != null);
    }

    if (endpoint.auth != null && endpoint.auth.length > 0) {
        return endpoint.auth
            .map((schemeId) => {
                const scheme = authsMap[schemeId];
                if (!scheme) {
                    return null;
                }
                return {
                    key: String(schemeId),
                    schemeIds: [schemeId],
                    schemes: [scheme],
                    label: getAuthSchemeLabel(scheme)
                };
            })
            .filter((entry): entry is AuthOptionEntry => entry != null);
    }

    return [];
}

export function createEndpointContext(
    node: EndpointNode | undefined,
    apiDefinition: ApiDefinition | undefined
): EndpointContext | undefined {
    if (!node) {
        console.warn("[createEndpointContext] node is undefined");
        return undefined;
    }
    if (apiDefinition == null) {
        console.warn(
            `[createEndpointContext] apiDefinition is undefined for node id=${node.id}, endpointId=${node.endpointId}`
        );
        return undefined;
    }
    const api = prune(apiDefinition, node);
    const endpoint = api.endpoints[node.endpointId];
    if (!endpoint) {
        const availableEndpointIds = Object.keys(api.endpoints);
        console.warn(
            `[createEndpointContext] endpoint not found after pruning. endpointId=${node.endpointId}, apiDefinitionId=${node.apiDefinitionId}, availableEndpointIds=[${availableEndpointIds.join(", ")}]`
        );
        return undefined;
    }
    return {
        node,
        endpoint,
        auths: endpoint.auth?.map((id) => api.auths[id]).filter((auth): auth is AuthScheme => auth != null) ?? [],
        authsWithKeys:
            endpoint.auth
                ?.map((id) => {
                    const scheme = api.auths[id];
                    return scheme ? { key: id, scheme } : null;
                })
                .filter((item): item is AuthSchemeWithKey => item != null) ?? [],
        authOptions: constructAuthOptions(endpoint, api.auths),
        authOptionEntries: constructAuthOptionEntries(endpoint, api.auths),
        globalHeaders: api.globalHeaders ?? [],
        types: api.types
    };
}

export type WebSocketContext = {
    node: WebSocketNode;
    channel: WebSocketChannel;
    globalHeaders: ObjectProperty[];
    auths: AuthScheme[];
    authsWithKeys: AuthSchemeWithKey[];
    authOptions: AuthScheme[][];
    authOptionEntries: AuthOptionEntry[];
    types: Record<TypeId, TypeDefinition>;
};

function constructWebSocketAuthOptions(
    channel: WebSocketChannel,
    authsMap: Record<AuthSchemeId, AuthScheme>
): AuthScheme[][] {
    if (channel.auth != null && channel.auth.length > 0) {
        return channel.auth
            .map((schemeId) => {
                const scheme = authsMap[schemeId];
                return scheme ? [scheme] : null;
            })
            .filter((group): group is AuthScheme[] => group != null);
    }

    return [];
}

function constructWebSocketAuthOptionEntries(
    channel: WebSocketChannel,
    authsMap: Record<AuthSchemeId, AuthScheme>
): AuthOptionEntry[] {
    if (channel.auth != null && channel.auth.length > 0) {
        return channel.auth
            .map((schemeId) => {
                const scheme = authsMap[schemeId];
                if (!scheme) {
                    return null;
                }
                return {
                    key: String(schemeId),
                    schemeIds: [schemeId],
                    schemes: [scheme],
                    label: getAuthSchemeLabel(scheme)
                };
            })
            .filter((entry): entry is AuthOptionEntry => entry != null);
    }

    return [];
}

export function createWebSocketContext(
    node: WebSocketNode | undefined,
    apiDefinition: ApiDefinition | undefined
): WebSocketContext | undefined {
    if (!node) {
        console.warn("[createWebSocketContext] node is undefined");
        return undefined;
    }
    if (apiDefinition == null) {
        console.warn(
            `[createWebSocketContext] apiDefinition is undefined for node id=${node.id}, webSocketId=${node.webSocketId}`
        );
        return undefined;
    }
    const api = prune(apiDefinition, node);
    const channel = api.websockets[node.webSocketId];
    if (!channel) {
        const availableWebSocketIds = Object.keys(api.websockets);
        console.warn(
            `[createWebSocketContext] webSocket channel not found after pruning. webSocketId=${node.webSocketId}, apiDefinitionId=${node.apiDefinitionId}, availableWebSocketIds=[${availableWebSocketIds.join(", ")}]`
        );
        return undefined;
    }
    return {
        node,
        channel,
        auths: channel.auth?.map((id) => api.auths[id]).filter((auth): auth is AuthScheme => auth != null) ?? [],
        authsWithKeys:
            channel.auth
                ?.map((id) => {
                    const scheme = api.auths[id];
                    return scheme ? { key: id, scheme } : null;
                })
                .filter((item): item is AuthSchemeWithKey => item != null) ?? [],
        authOptions: constructWebSocketAuthOptions(channel, api.auths),
        authOptionEntries: constructWebSocketAuthOptionEntries(channel, api.auths),
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
        console.warn("[createWebhookContext] node is undefined");
        return undefined;
    }
    if (apiDefinition == null) {
        console.warn(
            `[createWebhookContext] apiDefinition is undefined for node id=${node.id}, webhookId=${node.webhookId}`
        );
        return undefined;
    }
    const api = prune(apiDefinition, node);
    const webhook = api.webhooks[node.webhookId];
    if (!webhook) {
        const availableWebhookIds = Object.keys(api.webhooks);
        console.warn(
            `[createWebhookContext] webhook not found after pruning. webhookId=${node.webhookId}, apiDefinitionId=${node.apiDefinitionId}, availableWebhookIds=[${availableWebhookIds.join(", ")}]`
        );
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
        console.warn("[createGrpcContext] node is undefined");
        return undefined;
    }
    if (apiDefinition == null) {
        console.warn(`[createGrpcContext] apiDefinition is undefined for node id=${node.id}, grpcId=${node.grpcId}`);
        return undefined;
    }
    const api = prune(apiDefinition, node);
    const grpc = api.endpoints[node.grpcId as unknown as EndpointId];
    if (!grpc) {
        const availableEndpointIds = Object.keys(api.endpoints);
        console.warn(
            `[createGrpcContext] grpc endpoint not found after pruning. grpcId=${node.grpcId}, apiDefinitionId=${node.apiDefinitionId}, availableEndpointIds=[${availableEndpointIds.join(", ")}]`
        );
        return undefined;
    }
    return {
        node,
        grpc,
        types: api.types
    };
}

export type GraphqlContext = {
    node: GraphQlNode;
    operation: GraphQlOperation;
    types: Record<TypeId, TypeDefinition>;
};

export function createGraphqlContext(
    node: GraphQlNode | undefined,
    apiDefinition: ApiDefinition | undefined
): GraphqlContext | undefined {
    if (!node) {
        console.warn("[createGraphqlContext] node is undefined");
        return undefined;
    }
    if (apiDefinition == null) {
        console.warn(
            `[createGraphqlContext] apiDefinition is undefined for node id=${node.id}, graphqlOperationId=${node.graphqlOperationId}`
        );
        return undefined;
    }
    const api = prune(apiDefinition, node);
    const operation = api.graphqlOperations[node.graphqlOperationId];
    if (!operation) {
        const availableOperationIds = Object.keys(api.graphqlOperations);
        console.warn(
            `[createGraphqlContext] graphql operation not found after pruning. graphqlOperationId=${node.graphqlOperationId}, apiDefinitionId=${node.apiDefinitionId}, availableOperationIds=[${availableOperationIds.join(", ")}]`
        );
        return undefined;
    }
    return {
        node,
        operation,
        types: api.types
    };
}
