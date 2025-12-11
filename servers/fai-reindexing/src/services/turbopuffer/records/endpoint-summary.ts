import { ApiDefinition, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import { toDescription } from "@fern-docs/search-utils";

function getRequestBodyProperties(
    request: ApiDefinition.HttpRequest | undefined,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): ApiDefinition.ObjectProperty[] {
    if (request?.body == null) {
        return [];
    }

    if (request.body.type === "object") {
        return request.body.properties ?? [];
    }

    if (request.body.type === "alias" && request.body.value.type === "id") {
        const typeDef = types[request.body.value.id];
        if (typeDef?.shape?.type === "object") {
            return typeDef.shape.properties ?? [];
        }
    }

    return [];
}

function getResponseDescription(
    response: ApiDefinition.HttpResponse | undefined,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): string | undefined {
    if (response == null) {
        return undefined;
    }

    if (response.description != null) {
        return toDescription(response.description);
    }

    const body = response.body;
    if (body.type === "object" && body.properties != null && body.properties.length > 0) {
        const props = body.properties.map((p) => p.key);
        return `an object containing ${formatListWithAnd(props)}`;
    }

    if (body.type === "alias" && body.value.type === "id") {
        const typeDef = types[body.value.id];
        if (typeDef != null) {
            if (typeDef.description != null) {
                return toDescription(typeDef.description);
            }
            return typeDef.name;
        }
    }

    if (body.type === "stream" || body.type === "streamingText") {
        return "a streaming response";
    }

    if (body.type === "fileDownload") {
        return "a file download";
    }

    return undefined;
}

function formatListWithAnd(items: string[]): string {
    if (items.length === 0) {
        return "";
    }
    if (items.length === 1) {
        return items[0];
    }
    if (items.length === 2) {
        return `${items[0]} and ${items[1]}`;
    }
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function buildEndpointSummary(
    title: string,
    endpoint: ApiDefinition.EndpointDefinition,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): string {
    const parts: string[] = [];

    const description = endpoint.description != null ? toDescription(endpoint.description) : undefined;
    const method = endpoint.method;
    const path = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);

    if (description != null && description.length > 0) {
        parts.push(`${title} (${method} ${path}): ${description}`);
    } else {
        parts.push(`${title} is a ${method} endpoint at ${path}.`);
    }

    const allParams: ApiDefinition.ObjectProperty[] = [
        ...(endpoint.pathParameters ?? []),
        ...(endpoint.queryParameters ?? []),
        ...getRequestBodyProperties(endpoint.requests?.[0], types)
    ];

    if (allParams.length > 0) {
        const paramNames = allParams.map((p) => p.key);
        parts.push(`This endpoint accepts ${formatListWithAnd(paramNames)} as parameters.`);
    }

    const successResponse = endpoint.responses?.find((r) => r.statusCode >= 200 && r.statusCode < 300);
    const responseDesc = getResponseDescription(successResponse, types);
    if (responseDesc != null) {
        parts.push(`It returns ${responseDesc}.`);
    }

    return parts.join(" ");
}

export function buildWebSocketSummary(
    title: string,
    endpoint: ApiDefinition.WebSocketChannel,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): string {
    const parts: string[] = [];

    const description = endpoint.description != null ? toDescription(endpoint.description) : undefined;
    const path = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);

    if (description != null && description.length > 0) {
        parts.push(`${title} (WebSocket ${path}): ${description}`);
    } else {
        parts.push(`${title} is a WebSocket endpoint at ${path}.`);
    }

    const allParams: ApiDefinition.ObjectProperty[] = [
        ...(endpoint.pathParameters ?? []),
        ...(endpoint.queryParameters ?? [])
    ];

    if (allParams.length > 0) {
        const paramNames = allParams.map((p) => p.key);
        parts.push(`This endpoint accepts ${formatListWithAnd(paramNames)} as parameters.`);
    }

    if (endpoint.messages.length > 0) {
        const messageNames = endpoint.messages
            .map((m) => m.displayName ?? m.type)
            .filter((name): name is string => name != null);
        if (messageNames.length > 0) {
            parts.push(`It supports the following message types: ${formatListWithAnd(messageNames)}.`);
        }
    }

    return parts.join(" ");
}

export function buildWebhookSummary(
    title: string,
    node: FernNavigationType.WebhookNode,
    endpoint: ApiDefinition.WebhookDefinition,
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>
): string {
    const parts: string[] = [];

    const description = endpoint.description != null ? toDescription(endpoint.description) : undefined;
    const method = node.method;
    const path = endpoint.path.join("");

    if (description != null && description.length > 0) {
        parts.push(`${title} (${method} ${path}): ${description}`);
    } else {
        parts.push(`${title} is a ${method} webhook at ${path}.`);
    }

    const payload = endpoint.payloads?.[0];
    if (payload?.shape.type === "object" && payload.shape.properties != null) {
        const paramNames = payload.shape.properties.map((p) => p.key);
        parts.push(`The webhook payload contains ${formatListWithAnd(paramNames)}.`);
    }

    return parts.join(" ");
}
