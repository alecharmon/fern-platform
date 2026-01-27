import type { ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";

import type { AlgoliaRecord, BaseRecord } from "../types";
import { createApiReferenceRecordGraphQl } from "./create-api-reference-record-graphql";
import { createApiReferenceRecordGrpc } from "./create-api-reference-record-grpc";
import { createApiReferenceRecordHttp } from "./create-api-reference-record-http";
import { createApiReferenceRecordWebSocket } from "./create-api-reference-record-web-socket";
import { createApiReferenceRecordWebhook } from "./create-api-reference-record-webhook";
import { createEndpointBaseRecordGrpc } from "./create-endpoint-record-gprc";
import { createEndpointBaseRecordGraphQl } from "./create-endpoint-record-graphql";
import { createEndpointBaseRecordHttp } from "./create-endpoint-record-http";
import { createEndpointBaseRecordWebSocket } from "./create-endpoint-record-web-socket";
import { createEndpointBaseRecordWebhook } from "./create-endpoint-record-webhook";
import { createGraphQlParameterRecords } from "./create-parameter-records-graphql";
import { createGrpcParameterRecords } from "./create-parameter-records-grpc";
import { createHttpParameterRecords } from "./create-parameter-records-http";
import { createWebSocketParameterRecords } from "./create-parameter-records-web-socket";
import { createWebhookParameterRecords } from "./create-parameter-records-webhook";

interface CreateRecordsForApiLeafNodeOptions {
    node: FernNavigation.NavigationNodeApiLeaf;
    apiDefinition: ApiDefinition.ApiDefinition;
    base: BaseRecord;
}

function getGrpcIdAsEndpointId(grpcId: ApiDefinition.GrpcId): ApiDefinition.EndpointId {
    return grpcId as unknown as ApiDefinition.EndpointId;
}

/**
 * Creates Algolia records for a single API leaf node (endpoint, websocket, webhook, grpc, or graphql).
 * Returns an empty array if the node's corresponding definition is not found.
 */
export function createRecordsForApiLeafNode({
    node,
    apiDefinition,
    base
}: CreateRecordsForApiLeafNodeOptions): AlgoliaRecord[] {
    const records: AlgoliaRecord[] = [];

    if (node.type === "endpoint") {
        const endpoint = apiDefinition.endpoints[node.endpointId];
        if (!endpoint) {
            console.error(`API leaf node ${node.slug} has endpoint id ${node.endpointId} but no endpoint`);
            return records;
        }

        const endpointBase = createEndpointBaseRecordHttp({
            base,
            node,
            endpoint,
            types: apiDefinition.types
        });
        records.push(...createApiReferenceRecordHttp({ endpointBase, endpoint }));
        records.push(...createHttpParameterRecords({ endpointBase, endpoint, types: apiDefinition.types }));
        return records;
    }

    if (node.type === "webSocket") {
        const endpoint = apiDefinition.websockets[node.webSocketId];
        if (!endpoint) {
            console.error(`API leaf node ${node.slug} has web socket id ${node.webSocketId} but no web socket`);
            return records;
        }

        const endpointBase = createEndpointBaseRecordWebSocket({
            base,
            node,
            endpoint,
            types: apiDefinition.types
        });
        records.push(createApiReferenceRecordWebSocket({ endpointBase }));
        records.push(
            ...createWebSocketParameterRecords({ endpointBase, webSocket: endpoint, types: apiDefinition.types })
        );
        return records;
    }

    if (node.type === "webhook") {
        const endpoint = apiDefinition.webhooks[node.webhookId];
        if (!endpoint) {
            console.error(`API leaf node ${node.slug} has web hook id ${node.webhookId} but no web hook`);
            return records;
        }

        const endpointBase = createEndpointBaseRecordWebhook({
            base,
            node,
            endpoint,
            types: apiDefinition.types
        });
        records.push(...createApiReferenceRecordWebhook({ endpointBase, endpoint }));
        records.push(...createWebhookParameterRecords({ endpointBase, webhook: endpoint, types: apiDefinition.types }));
        return records;
    }

    if (node.type === "grpc") {
        const grpc = apiDefinition.endpoints[getGrpcIdAsEndpointId(node.grpcId)];
        if (!grpc) {
            console.error(`API leaf node ${node.slug} has grpc id ${node.grpcId} but no grpc`);
            return records;
        }

        const grpcMethodType =
            grpc.protocol?.type === "grpc" && grpc.protocol.methodType ? grpc.protocol.methodType : "UNARY";

        const grpcBase = createEndpointBaseRecordGrpc({
            base,
            node,
            grpc,
            grpcMethodType,
            types: apiDefinition.types
        });
        records.push(...createApiReferenceRecordGrpc({ grpcBase, grpc }));
        records.push(...createGrpcParameterRecords({ endpointBase: grpcBase, grpc, types: apiDefinition.types }));
        return records;
    }

    if (node.type === "graphql") {
        const graphqlOperation = apiDefinition.graphqlOperations[node.graphqlOperationId];
        if (!graphqlOperation) {
            console.error(
                `API leaf node ${node.slug} has graphql operation id ${node.graphqlOperationId} but no graphql operation`
            );
            return records;
        }

        const graphqlBase = createEndpointBaseRecordGraphQl({
            base,
            node,
            graphqlOperation,
            types: apiDefinition.types
        });
        records.push(...createApiReferenceRecordGraphQl({ graphqlBase, graphqlOperation }));
        records.push(
            ...createGraphQlParameterRecords({
                endpointBase: graphqlBase,
                graphqlOperation,
                types: apiDefinition.types
            })
        );
        return records;
    }

    return records;
}
