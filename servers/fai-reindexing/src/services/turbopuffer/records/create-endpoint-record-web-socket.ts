import { ApiDefinition, FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { createViewersForNodes, type TurbopufferRecord } from "@fern-docs/search-utils";
import { createHash } from "crypto";
import { flatten } from "es-toolkit/array";

import { buildWebSocketSummary } from "./endpoint-summary";
import { createKeywordAccumulator } from "./keyword-utils";

export function createEndpointBaseRecordWebSocket({
    parents,
    authed,
    node,
    endpoint,
    url,
    types
}: {
    node: FernNavigationType.WebSocketNode;
    parents: readonly FernNavigationType.NavigationNodeParent[];
    authed: boolean;
    endpoint: ApiDefinition.WebSocketChannel;
    url: string;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}): TurbopufferRecord {
    const versionNode = parents.find((n): n is FernNavigationType.VersionNode => n.type === "version");
    const productNode = parents.find((n): n is FernNavigationType.ProductNode => n.type === "product");
    const chunk = buildWebSocketSummary(node.title, endpoint, types);

    const keywords = createKeywordAccumulator();

    const colonPath = ApiDefinition.toColonEndpointPathLiteral(endpoint.path);
    const curlyPath = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);

    ["endpoint", "api", "websocket", "web socket", "stream"].forEach(keywords.add);
    keywords.add(node.title);
    keywords.add(endpoint.displayName);
    keywords.add(endpoint.operationId);
    keywords.add(colonPath);
    keywords.add(curlyPath);
    keywords.add(`WebSocket ${colonPath}`);
    keywords.add(`WebSocket ${curlyPath}`);

    ApiDefinition.Transformer.with({
        TypeShape: (type) => {
            if (type.type === "alias" && type.value.type === "id") {
                const definition = types[type.value.id];
                if (definition != null) {
                    keywords.add(definition.name);
                }
            }
            return type;
        },
        ObjectProperty: (property) => {
            keywords.add(property.key);
            return property;
        },
        WebSocketMessage: (message) => {
            keywords.add(message.displayName);
            keywords.add(message.type);
            return message;
        }
    }).webSocketChannel(endpoint, endpoint.id);

    const document_body = JSON.stringify(
        {
            api_type: "websocket",
            api_definition_id: node.apiDefinitionId,
            api_endpoint_id: node.webSocketId,
            method: "GET",
            endpoint_path: colonPath,
            endpoint_path_alternates: [
                curlyPath,
                ...(endpoint.environments?.map((environment) =>
                    String(new URL(colonPath, withDefaultProtocol(environment.baseUrl)))
                ) ?? []),
                ...(endpoint.environments?.map((environment) =>
                    String(new URL(curlyPath, withDefaultProtocol(environment.baseUrl)))
                ) ?? [])
            ],
            environments: flatten(
                endpoint.environments?.map((environment) => [environment.id, environment.baseUrl]) ?? []
            ),
            default_environment_id: endpoint.defaultEnvironment
        },
        null,
        2
    );

    const document = `${document_body}\n\n${chunk}`;

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    const breadcrumbs = FernNavigation.utils
        .createBreadcrumb([...parents, node])
        .map((b) => b.title)
        .join(", ");

    return {
        id: createHash("sha256").update(node.webSocketId).digest("hex"),
        attributes: {
            chunk,
            title: node.title,
            document,
            url,
            version: versionNode?.title,
            product: productNode?.title,
            authed: isNodeAuthed,
            roles: [...new Set(roles.flat())].sort(),
            keywords: keywords.values(),
            content_type: "websocket",
            breadcrumbs,
            chunk_index: 0,
            parent_id: node.webSocketId,
            parent_content_hash: createHash("sha256").update(document).digest("hex")
        }
    };
}
