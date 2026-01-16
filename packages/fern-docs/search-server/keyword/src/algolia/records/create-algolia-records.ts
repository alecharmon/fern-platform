import { type ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import { measureBytes } from "@fern-api/ui-core-utils";
import { groupBy } from "es-toolkit/array";

import type { AlgoliaRecord } from "../types";
import { createApiReferenceRecordGraphQl } from "./create-api-reference-record-graphql";
import { createApiReferenceRecordGrpc } from "./create-api-reference-record-grpc";
import { createApiReferenceRecordHttp } from "./create-api-reference-record-http";
import { createApiReferenceRecordWebSocket } from "./create-api-reference-record-web-socket";
import { createApiReferenceRecordWebhook } from "./create-api-reference-record-webhook";
import { createBaseRecord } from "./create-base-record";
import { createChangelogRecord } from "./create-changelog-record";
import { createEndpointBaseRecordGrpc } from "./create-endpoint-record-gprc";
import { createEndpointBaseRecordGraphQl } from "./create-endpoint-record-graphql";
import { createEndpointBaseRecordHttp } from "./create-endpoint-record-http";
import { createEndpointBaseRecordWebSocket } from "./create-endpoint-record-web-socket";
import { createEndpointBaseRecordWebhook } from "./create-endpoint-record-webhook";
import { createMarkdownRecords } from "./create-markdown-records";
import { createGraphQlParameterRecords } from "./create-parameter-records-graphql";
import { createGrpcParameterRecords } from "./create-parameter-records-grpc";
import { createHttpParameterRecords } from "./create-parameter-records-http";
import { createWebSocketParameterRecords } from "./create-parameter-records-web-socket";
import { createWebhookParameterRecords } from "./create-parameter-records-webhook";

interface CreateAlgoliaRecordsOptions {
    root: FernNavigation.RootNode;
    domain: string;
    org_id: string;
    pages: Record<FernNavigation.PageId, string>;
    apis: Record<ApiDefinition.ApiDefinitionId, ApiDefinition.ApiDefinition>;
    authed?: (node: NavigationNodePage) => boolean;
}

/**
 * Checks if a node or any of its ancestors is hidden.
 * This ensures that endpoints within hidden API packages are excluded from search indexes.
 */
function isEffectivelyHidden(
    node: FernNavigation.NavigationNodeWithMetadata,
    collector: ReturnType<typeof FernNavigation.NodeCollector.collect>
): boolean {
    if (node.hidden === true) {
        return true;
    }

    const parents = collector.getParents(node.id) ?? [];
    return parents.some((parent) => FernNavigation.hasMetadata(parent) && parent.hidden === true);
}

export function createAlgoliaRecords({ root, domain, org_id, pages, apis, authed }: CreateAlgoliaRecordsOptions): {
    records: AlgoliaRecord[];
    /**
     * Records that are >= 100kb
     */
    tooLarge: {
        record: AlgoliaRecord;
        size: number;
    }[];
} {
    const collector = FernNavigation.NodeCollector.collect(root);

    const versionNodes = collector.getVersionNodes();
    const versionIndexMap = new Map<string, number>();
    for (const [idx, v] of versionNodes.entries()) {
        versionIndexMap.set(v.versionId, idx);
        console.log(`[algolia] version_index: ${v.versionId} -> ${idx}`);
    }

    const pageNodes = Array.from(collector.slugMap.values())
        .filter(FernNavigation.isPage)
        // exclude hidden pages and pages within hidden packages
        .filter((node) => !isEffectivelyHidden(node, collector))
        // exclude pages that are noindexed
        .filter((node) => (FernNavigation.hasMarkdown(node) ? node.noindex !== true : true));

    const markdownNodes = pageNodes.filter(FernNavigation.hasMarkdown);
    const apiLeafNodes = pageNodes.filter(FernNavigation.isApiLeaf);

    const records: AlgoliaRecord[] = [];

    markdownNodes.forEach((node) => {
        const pageId = FernNavigation.getPageId(node);
        if (!pageId) {
            console.error(`Page node ${node.slug} has no page id`);
            return;
        }

        const markdown = pages[pageId];
        if (!markdown) {
            console.error(`Page node ${node.slug} has page id ${pageId} but no markdown`);
            return;
        }

        const base = createBaseRecord({
            node,
            parents: collector.getParents(node.id) ?? [],
            domain,
            org_id,
            authed: authed?.(node) ?? false,
            versionIndexMap
        });

        if (node.type === "changelogEntry") {
            records.push(...createChangelogRecord({ base, markdown, date: node.date }));
        } else {
            records.push(...createMarkdownRecords({ base, markdown }));
        }
    });

    apiLeafNodes.forEach((node) => {
        const apiDefinition = apis[node.apiDefinitionId];

        if (!apiDefinition) {
            console.error(
                `API leaf node ${node.slug} has api definition id ${node.apiDefinitionId} but no api definition`
            );
            return;
        }

        const base = createBaseRecord({
            node,
            parents: collector.getParents(node.id) ?? [],
            domain,
            org_id,
            authed: authed?.(node) ?? false,
            versionIndexMap
        });

        if (node.type === "endpoint") {
            const endpoint = apiDefinition.endpoints[node.endpointId];
            if (!endpoint) {
                console.error(`API leaf node ${node.slug} has endpoint id ${node.endpointId} but no endpoint`);
                return;
            }

            const endpointBase = createEndpointBaseRecordHttp({
                base,
                node,
                endpoint,
                types: apiDefinition.types
            });
            records.push(...createApiReferenceRecordHttp({ endpointBase, endpoint }));
            records.push(...createHttpParameterRecords({ endpointBase, endpoint, types: apiDefinition.types }));
            return;
        }

        if (node.type === "webSocket") {
            const endpoint = apiDefinition.websockets[node.webSocketId];
            if (!endpoint) {
                console.error(`API leaf node ${node.slug} has web socket id ${node.webSocketId} but no web socket`);
                return;
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
            return;
        }

        if (node.type === "webhook") {
            const endpoint = apiDefinition.webhooks[node.webhookId];
            if (!endpoint) {
                console.error(`API leaf node ${node.slug} has web hook id ${node.webhookId} but no web hook`);
                return;
            }

            const endpointBase = createEndpointBaseRecordWebhook({
                base,
                node,
                endpoint,
                types: apiDefinition.types
            });
            records.push(...createApiReferenceRecordWebhook({ endpointBase, endpoint }));
            records.push(
                ...createWebhookParameterRecords({ endpointBase, webhook: endpoint, types: apiDefinition.types })
            );
            return;
        }

        if (node.type === "grpc") {
            const grpc = apiDefinition.endpoints[getGrpcIdAsEndpointId(node.grpcId)];
            if (!grpc) {
                console.error(`API leaf node ${node.slug} has grpc id ${node.grpcId} but no grpc`);
                return;
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
            return;
        }

        if (node.type === "graphql") {
            const graphqlOperation = apiDefinition.graphqlOperations[node.graphqlOperationId];
            if (!graphqlOperation) {
                console.error(
                    `API leaf node ${node.slug} has graphql operation id ${node.graphqlOperationId} but no graphql operation`
                );
                return;
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
            return;
        }
    });

    // const distinctSlugs = new Set<string>();
    // collector.getNodesInOrder().forEach((node) => {
    //     if (!FernNavigation.hasMetadata(node)) {
    //         return;
    //     }

    //     if (distinctSlugs.has(node.slug)) {
    //         return;
    //     }

    //     distinctSlugs.add(node.slug);

    //     const base = createBaseRecord({ node, parents: collector.getParents(node.id) ?? [], domain, org_id, authed });
    //     records.push(createNavigationRecord({ base, node_type: node.type }));
    // });

    // remove all undefined values and filter out any record that is >= 100kb
    const jsonRecords = records.map((record) => JSON.stringify(record));
    const grouped = groupBy(jsonRecords, (record): "indexable" | "tooLarge" =>
        measureBytes(record) <= 100 * 1000 ? "indexable" : "tooLarge"
    );
    return {
        records: grouped.indexable?.map((record) => JSON.parse(record)) ?? [],
        tooLarge:
            grouped.tooLarge?.map((record) => ({
                record: JSON.parse(record),
                size: measureBytes(record)
            })) ?? []
    };
}

function getGrpcIdAsEndpointId(grpcId: ApiDefinition.GrpcId): ApiDefinition.EndpointId {
    return grpcId as unknown as ApiDefinition.EndpointId;
}
