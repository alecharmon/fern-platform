import { ApiDefinition } from "@fern-api/fdr-sdk";
import { dump as yamlStringify } from "js-yaml";
import type { OpenAPIV3_1 } from "openapi-types";
import { convertToOpenApiSchema, type EndpointContext } from "./endpointDefinitionToOpenApi.js";

export interface WebSocketAsyncContext {
    websocket: ApiDefinition.WebSocketChannel;
    types: Record<string, ApiDefinition.TypeDefinition>;
    globalHeaders?: ApiDefinition.ObjectProperty[];
    apiDefinition?: ApiDefinition.ApiDefinition;
    components: Record<string, OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject>;
    visitedTypes: Set<string>;
}

interface AsyncAPIDocument {
    asyncapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Record<string, AsyncAPIServer>;
    channels: Record<string, AsyncAPIChannel>;
    components?: {
        messages?: Record<string, AsyncAPIMessage>;
        schemas?: Record<string, OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject>;
    };
}

interface AsyncAPIServer {
    url: string;
    protocol: string;
    description?: string;
    [extension: `x-${string}`]: unknown;
}

interface AsyncAPIChannel {
    description?: string;
    parameters?: Record<string, AsyncAPIParameter>;
    bindings?: {
        ws?: {
            query?: OpenAPIV3_1.SchemaObject;
            headers?: OpenAPIV3_1.SchemaObject;
        };
    };
    publish?: {
        operationId?: string;
        summary?: string;
        description?: string;
        message?: AsyncAPIMessage | { oneOf: Array<{ $ref: string }> };
    };
    subscribe?: {
        operationId?: string;
        summary?: string;
        description?: string;
        message?: AsyncAPIMessage | { oneOf: Array<{ $ref: string }> };
    };
}

interface AsyncAPIParameter {
    description?: string;
    schema: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;
}

interface AsyncAPIMessage {
    name?: string;
    title?: string;
    summary?: string;
    description?: string;
    payload?: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;
}

export class AsyncApiYamlFormatter {
    public generateYamlFromWebSocket(
        websocket: ApiDefinition.WebSocketChannel,
        apiDefinition?: ApiDefinition.ApiDefinition
    ): string {
        const context: WebSocketAsyncContext = {
            websocket,
            types: apiDefinition?.types || {},
            globalHeaders: apiDefinition?.globalHeaders,
            apiDefinition,
            components: {},
            visitedTypes: new Set<string>()
        };

        const asyncApiSpec = generateAsyncApiFromWebSocketContext(context);

        return yamlStringify(asyncApiSpec);
    }
}

function generateAsyncApiFromWebSocketContext(context: WebSocketAsyncContext): AsyncAPIDocument {
    const { websocket, globalHeaders } = context;

    const channelPath = ApiDefinition.toCurlyBraceEndpointPathLiteral(websocket.path);

    const toWsUrl = (url: string): string | undefined => {
        try {
            const u = new URL(url);
            if (u.protocol === "http:") {
                u.protocol = "ws:";
            } else if (u.protocol === "https:") {
                u.protocol = "wss:";
            } else if (u.protocol !== "ws:" && u.protocol !== "wss:") {
                return undefined;
            }
            return u.toString();
        } catch {
            return undefined;
        }
    };

    // Extract environments from websocket
    const envs = websocket.environments ?? [];
    const servers: Record<string, AsyncAPIServer> = {};

    for (const env of envs) {
        const wsUrl = toWsUrl(env.baseUrl);
        if (!wsUrl) {
            continue;
        }
        const protocol = wsUrl.startsWith("wss:") ? "wss" : "ws";
        const key = String(env.id);
        servers[key] = { url: wsUrl, protocol };
        if (websocket.defaultEnvironment && websocket.defaultEnvironment === env.id) {
            servers[key]["x-default"] = true;
        }
    }

    const doc: AsyncAPIDocument = {
        asyncapi: "2.6.0",
        info: {
            title: websocket.displayName ?? "WebSocket",
            version: websocket.id,
            description: typeof websocket.description === "string" ? websocket.description : undefined
        },
        channels: {}
    };

    if (Object.keys(servers).length > 0) {
        doc.servers = servers;
    }

    const channel: AsyncAPIChannel = {
        description: typeof websocket.description === "string" ? websocket.description : undefined
    };

    if (websocket.pathParameters && websocket.pathParameters.length > 0) {
        channel.parameters = {};
        websocket.pathParameters.forEach((param) => {
            const schema = convertToOpenApiSchema(
                param.valueShape,
                context as unknown as EndpointContext
            ) as OpenAPIV3_1.SchemaObject;
            channel.parameters![param.key] = {
                description: param.description,
                schema
            };
        });
    }

    const queryHeaders = [...(globalHeaders || []), ...(websocket.requestHeaders || [])];
    const queryParams = websocket.queryParameters || [];

    if (queryParams.length > 0 || queryHeaders.length > 0) {
        channel.bindings = { ws: {} };

        if (queryParams.length > 0) {
            const queryProperties: Record<string, OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject> = {};
            queryParams.forEach((param) => {
                queryProperties[param.key] = convertToOpenApiSchema(
                    param.valueShape,
                    context as unknown as EndpointContext
                );
            });
            channel.bindings.ws!.query = {
                type: "object",
                properties: queryProperties
            };
        }

        if (queryHeaders.length > 0) {
            const headerProperties: Record<string, OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject> = {};
            queryHeaders.forEach((header) => {
                headerProperties[header.key] = convertToOpenApiSchema(
                    header.valueShape,
                    context as unknown as EndpointContext
                );
            });
            channel.bindings.ws!.headers = {
                type: "object",
                properties: headerProperties
            };
        }
    }

    const serverMessages = websocket.messages.filter((msg) => msg.origin === "server");
    const clientMessages = websocket.messages.filter((msg) => msg.origin === "client");

    if (serverMessages.length > 0) {
        if (serverMessages.length === 1) {
            const msg = serverMessages[0];
            if (msg) {
                channel.publish = {
                    operationId: `${websocket.operationId || websocket.id}-publish`,
                    summary: msg.displayName || `Server message`,
                    description: typeof msg.description === "string" ? msg.description : undefined,
                    message: {
                        name: msg.type,
                        title: msg.displayName,
                        description: typeof msg.description === "string" ? msg.description : undefined,
                        payload: msg.body
                            ? convertToOpenApiSchema(msg.body, context as unknown as EndpointContext)
                            : undefined
                    }
                };
            }
        } else {
            if (!doc.components) {
                doc.components = {};
            }
            if (!doc.components.messages) {
                doc.components.messages = {};
            }

            serverMessages.forEach((msg, idx) => {
                const messageName = `${websocket.id}-server-${idx}${msg.type ? `-${msg.type}` : ""}`;
                doc.components!.messages![messageName] = {
                    name: msg.type,
                    title: msg.displayName,
                    description: typeof msg.description === "string" ? msg.description : undefined,
                    payload: msg.body
                        ? convertToOpenApiSchema(msg.body, context as unknown as EndpointContext)
                        : undefined
                };
            });

            channel.publish = {
                operationId: `${websocket.operationId || websocket.id}-publish`,
                summary: "Server messages",
                message: {
                    oneOf: serverMessages.map((msg, idx) => ({
                        $ref: `#/components/messages/${websocket.id}-server-${idx}${msg.type ? `-${msg.type}` : ""}`
                    }))
                }
            };
        }
    }

    if (clientMessages.length > 0) {
        if (clientMessages.length === 1) {
            const msg = clientMessages[0];
            if (msg) {
                channel.subscribe = {
                    operationId: `${websocket.operationId || websocket.id}-subscribe`,
                    summary: msg.displayName || `Client message`,
                    description: typeof msg.description === "string" ? msg.description : undefined,
                    message: {
                        name: msg.type,
                        title: msg.displayName,
                        description: typeof msg.description === "string" ? msg.description : undefined,
                        payload: msg.body
                            ? convertToOpenApiSchema(msg.body, context as unknown as EndpointContext)
                            : undefined
                    }
                };
            }
        } else {
            if (!doc.components) {
                doc.components = {};
            }
            if (!doc.components.messages) {
                doc.components.messages = {};
            }

            clientMessages.forEach((msg, idx) => {
                const messageName = `${websocket.id}-client-${idx}${msg.type ? `-${msg.type}` : ""}`;
                doc.components!.messages![messageName] = {
                    name: msg.type,
                    title: msg.displayName,
                    description: typeof msg.description === "string" ? msg.description : undefined,
                    payload: msg.body
                        ? convertToOpenApiSchema(msg.body, context as unknown as EndpointContext)
                        : undefined
                };
            });

            channel.subscribe = {
                operationId: `${websocket.operationId || websocket.id}-subscribe`,
                summary: "Client messages",
                message: {
                    oneOf: clientMessages.map((msg, idx) => ({
                        $ref: `#/components/messages/${websocket.id}-client-${idx}${msg.type ? `-${msg.type}` : ""}`
                    }))
                }
            };
        }
    }

    doc.channels[channelPath] = channel;

    if (Object.keys(context.components).length > 0) {
        if (!doc.components) {
            doc.components = {};
        }
        doc.components.schemas = context.components;
    }

    return doc;
}
