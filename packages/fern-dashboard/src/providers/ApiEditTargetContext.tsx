"use client";

/**
 * API Edit Target Context
 *
 * Tracks the current API element (endpoint, type, etc.) being rendered,
 * enabling child components to build description edit targets.
 */

import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Information about the current endpoint being rendered.
 */
export interface EndpointEditTarget {
    type: "endpoint";
    operationId?: string;
    method: string;
    path: string;
}

/**
 * Information about a WebSocket channel being rendered.
 * WebSocket descriptions are not yet editable, but we need the target
 * to show edit-disabled indicators.
 */
export interface WebSocketEditTarget {
    type: "websocket";
    path: string;
}

/**
 * Information about a Webhook being rendered.
 * Webhook descriptions are not yet editable, but we need the target
 * to show edit-disabled indicators.
 */
export interface WebhookEditTarget {
    type: "webhook";
    webhookId: string;
}

/**
 * Information about a gRPC method being rendered.
 * gRPC descriptions are not yet editable (proto format), but we need the target
 * to show edit-disabled indicators.
 */
export interface GrpcEditTarget {
    type: "grpc";
    methodId: string;
}

/**
 * Information about the current schema type being rendered.
 */
export interface SchemaEditTarget {
    type: "schema";
    typeId: string;
}

/**
 * Union of possible edit targets.
 */
export type ApiEditTarget =
    | EndpointEditTarget
    | WebSocketEditTarget
    | WebhookEditTarget
    | GrpcEditTarget
    | SchemaEditTarget;

interface ApiEditTargetContextValue {
    /** The current API element being rendered */
    target: ApiEditTarget | null;
}

const ApiEditTargetContext = createContext<ApiEditTargetContextValue>({
    target: null
});

export interface ApiEditTargetProviderProps {
    children: ReactNode;
    target: ApiEditTarget;
}

/**
 * Provider that sets the current API edit target.
 * Wrap around API reference components to enable description editing.
 */
export function ApiEditTargetProvider({ children, target }: ApiEditTargetProviderProps) {
    const value = useMemo(() => ({ target }), [target]);
    return <ApiEditTargetContext.Provider value={value}>{children}</ApiEditTargetContext.Provider>;
}

/**
 * Hook to access the current API edit target.
 */
export function useApiEditTarget(): ApiEditTarget | null {
    const { target } = useContext(ApiEditTargetContext);
    return target;
}

/**
 * Create an endpoint edit target from an endpoint definition.
 */
export function createEndpointEditTarget(endpoint: ApiDefinition.EndpointDefinition): EndpointEditTarget {
    // Build the path string from path parts
    const pathString = endpoint.path.map((part) => (part.type === "literal" ? part.value : `{${part.value}}`)).join("");

    return {
        type: "endpoint",
        operationId: endpoint.operationId,
        method: endpoint.method,
        path: pathString
    };
}

/**
 * Create a schema edit target from a type ID.
 */
export function createSchemaEditTarget(typeId: string): SchemaEditTarget {
    return {
        type: "schema",
        typeId
    };
}

/**
 * Create a WebSocket edit target from a WebSocket channel.
 * Note: WebSocket descriptions are not yet editable, this is for showing edit-disabled indicators.
 */
export function createWebSocketEditTarget(channel: ApiDefinition.WebSocketChannel): WebSocketEditTarget {
    // Build the path string from path parts
    const pathString = channel.path.map((part) => (part.type === "literal" ? part.value : `{${part.value}}`)).join("");

    return {
        type: "websocket",
        path: pathString
    };
}

/**
 * Create a Webhook edit target from a Webhook definition.
 * Note: Webhook descriptions are not yet editable, this is for showing edit-disabled indicators.
 */
export function createWebhookEditTarget(webhook: ApiDefinition.WebhookDefinition): WebhookEditTarget {
    return {
        type: "webhook",
        webhookId: webhook.id
    };
}

/**
 * Create a gRPC edit target from a gRPC endpoint definition.
 * Note: gRPC descriptions are not yet editable (proto format), this is for showing edit-disabled indicators.
 */
export function createGrpcEditTarget(grpc: ApiDefinition.EndpointDefinition): GrpcEditTarget {
    return {
        type: "grpc",
        methodId: grpc.id
    };
}
