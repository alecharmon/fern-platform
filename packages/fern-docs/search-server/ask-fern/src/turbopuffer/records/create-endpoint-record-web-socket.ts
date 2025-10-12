import { ApiDefinition, type FernNavigation } from "@fern-api/fdr-sdk";
import { truncateToBytes, withDefaultProtocol } from "@fern-api/ui-core-utils";
import {
    createDelimitedRolesetString,
    createViewersForNodes,
    maybePrepareMdxContent,
    toDescription
} from "@fern-docs/search-utils";
import { createHash } from "crypto";
import { flatten } from "es-toolkit/array";

import type { TurbopufferRecord } from "../types";

export function createEndpointBaseRecordWebSocket({
    parents,
    authed,
    node,
    endpoint,
    url,
    types
}: {
    node: FernNavigation.WebSocketNode;
    parents: readonly FernNavigation.NavigationNodeParent[];
    authed: boolean;
    endpoint: ApiDefinition.WebSocketChannel;
    url: string;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}): TurbopufferRecord {
    const versionNode = parents.find((n): n is FernNavigation.VersionNode => n.type === "version");
    const productNode = parents.find((n): n is FernNavigation.ProductNode => n.type === "product");
    const prepared = maybePrepareMdxContent(toDescription(endpoint.description));

    const keywords: string[] = [];
    keywords.push("endpoint", "api", "websocket", "web socket", "stream");

    ApiDefinition.Transformer.with({
        TypeShape: (type) => {
            if (type.type === "alias" && type.value.type === "id") {
                const definition = types[type.value.id];
                if (definition != null) {
                    keywords.push(definition.name);
                }
            }
            return type;
        }
    }).webSocketChannel(endpoint, endpoint.id);

    const endpoint_path = ApiDefinition.toColonEndpointPathLiteral(endpoint.path);
    const endpoint_path_curly = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);

    const document_body = JSON.stringify(
        {
            api_type: "websocket",
            api_definition_id: node.apiDefinitionId,
            api_endpoint_id: node.webSocketId,
            method: "GET",
            endpoint_path,
            endpoint_path_alternates: [
                endpoint_path_curly,
                ...(endpoint.environments?.map((environment) =>
                    String(new URL(endpoint_path, withDefaultProtocol(environment.baseUrl)))
                ) ?? []),
                ...(endpoint.environments?.map((environment) =>
                    String(new URL(endpoint_path_curly, withDefaultProtocol(environment.baseUrl)))
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

    const description = prepared.content != null ? truncateToBytes(prepared.content, 50 * 1000) : undefined;
    const document = `${document_body}\n\n${description}`;

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    return {
        id: createHash("sha256").update(node.webSocketId).digest("hex"),
        attributes: {
            chunk: prepared.content ?? "",
            title: node.title,
            document,
            url,
            version: versionNode?.title,
            product: productNode?.title,
            authed: isNodeAuthed,
            roles: roles.map((role) => createDelimitedRolesetString(role)),
            keywords
        }
    };
}
