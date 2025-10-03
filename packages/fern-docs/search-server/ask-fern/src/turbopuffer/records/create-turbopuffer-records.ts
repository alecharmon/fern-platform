import { flatten } from "es-toolkit/array";

import { slugToHref } from "@fern-api/docs-utils";
import { ApiDefinition } from "@fern-api/fdr-sdk/api-definition";
import {
    ApiDefinitionId,
    NavigationNodePage,
    NodeCollector,
    PageId,
    RootNode,
    getPageId,
    hasMarkdown,
    isApiLeaf
} from "@fern-api/fdr-sdk/navigation";

import { TurbopufferRecordWithoutVector } from "../types";
import { createEndpointBaseRecordHttp } from "./create-endpoint-record-http";
import { createEndpointBaseRecordWebSocket } from "./create-endpoint-record-web-socket";
import { createEndpointBaseRecordWebhook } from "./create-endpoint-record-webhook";
import { createMarkdownRecords } from "./create-markdown-records";

interface CreateTurbopufferRecordsOptions {
    root: RootNode;
    domain: string;
    pages: Record<PageId, string>;
    apis: Record<ApiDefinitionId, ApiDefinition>;
    authed?: (node: NavigationNodePage) => boolean;
    splitText: (text: string) => Promise<string[]>;
}

export async function createTurbopufferRecords({
    root,
    pages,
    apis,
    domain,
    authed
}: CreateTurbopufferRecordsOptions): Promise<TurbopufferRecordWithoutVector[]> {
    const collector = NodeCollector.collect(root);

    const pageNodes = collector.indexablePageNodesWithAuth;

    const markdownNodes = pageNodes.filter((node) => !isApiLeaf(node)).filter(hasMarkdown);
    const apiLeafNodes = pageNodes.filter(isApiLeaf);

    const markdownRecords = flatten(
        await Promise.all(
            markdownNodes.map(async (node): Promise<TurbopufferRecordWithoutVector[]> => {
                const pageId = getPageId(node);
                if (!pageId) {
                    console.error(`Page node ${node.slug} has no page id`);
                    return [];
                }

                const markdown = pages[pageId];
                if (!markdown) {
                    console.error(`Page node ${node.slug} has page id ${pageId} but no markdown`);
                    return [];
                }
                const path = slugToHref(node.slug);
                const url = `https://${domain}${path}`;
                const isChangelog = path?.includes("/changelog/");
                return createMarkdownRecords({
                    node,
                    parents: collector.getParents(node.id) ?? [],
                    authed: authed?.(node) ?? false,
                    markdown,
                    url,
                    isChangelog
                });
            })
        )
    );

    const apiReferenceRecords: TurbopufferRecordWithoutVector[] = [];
    apiLeafNodes.forEach((node) => {
        const apiDefinition = apis[node.apiDefinitionId];

        if (!apiDefinition) {
            console.error(
                `API leaf node ${node.slug} has api definition id ${node.apiDefinitionId} but no api definition`
            );
            return;
        }

        const url = `https://${domain}${slugToHref(node.slug)}`;

        if (node.type === "endpoint") {
            const endpoint = apiDefinition.endpoints[node.endpointId];
            if (!endpoint) {
                console.error(`API leaf node ${node.slug} has endpoint id ${node.endpointId} but no endpoint`);
                return;
            }

            apiReferenceRecords.push(
                createEndpointBaseRecordHttp({
                    node,
                    parents: collector.getParents(node.id) ?? [],
                    authed: authed?.(node) ?? false,
                    endpoint,
                    url,
                    types: apiDefinition.types
                })
            );
            return;
        }

        if (node.type === "webSocket") {
            const endpoint = apiDefinition.websockets[node.webSocketId];
            if (!endpoint) {
                console.error(`API leaf node ${node.slug} has web socket id ${node.webSocketId} but no web socket`);
                return;
            }

            apiReferenceRecords.push(
                createEndpointBaseRecordWebSocket({
                    node,
                    parents: collector.getParents(node.id) ?? [],
                    authed: authed?.(node) ?? false,
                    endpoint,
                    url,
                    types: apiDefinition.types
                })
            );
            return;
        }

        if (node.type === "webhook") {
            const endpoint = apiDefinition.webhooks[node.webhookId];
            if (!endpoint) {
                console.error(`API leaf node ${node.slug} has web hook id ${node.webhookId} but no web hook`);
                return;
            }

            apiReferenceRecords.push(
                createEndpointBaseRecordWebhook({
                    node,
                    parents: collector.getParents(node.id) ?? [],
                    authed: authed?.(node) ?? false,
                    endpoint,
                    url,
                    types: apiDefinition.types
                })
            );
            return;
        }
    });

    let records = [...markdownRecords, ...apiReferenceRecords];
    const nodeIds = new Set<string>();
    records = records.filter((r) => {
        if (nodeIds.has(r.id)) {
            return false;
        } else {
            nodeIds.add(r.id);
            return true;
        }
    });
    return records;
}
