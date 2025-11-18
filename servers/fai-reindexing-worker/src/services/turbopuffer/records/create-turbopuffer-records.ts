import { type ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import { flatten } from "es-toolkit/array";
import { slugToHref } from "../../../utils/slugToHref";

import type { TurbopufferRecordWithoutVector } from "../types";
import { createEndpointBaseRecordHttp } from "./create-endpoint-record-http";
import { createEndpointBaseRecordWebSocket } from "./create-endpoint-record-web-socket";
import { createEndpointBaseRecordWebhook } from "./create-endpoint-record-webhook";
import { createMarkdownRecords } from "./create-markdown-records";

interface CreateTurbopufferRecordsOptions {
    root: FernNavigation.RootNode;
    domain: string;
    pages: Record<FernNavigation.PageId, string>;
    apis: Record<ApiDefinition.ApiDefinitionId, ApiDefinition.ApiDefinition>;
    authed?: (node: NavigationNodePage) => boolean;
    splitText: (text: string) => Promise<string[]>;
}

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

export async function createTurbopufferRecords({
    root,
    pages,
    apis,
    domain,
    authed
}: CreateTurbopufferRecordsOptions): Promise<TurbopufferRecordWithoutVector[]> {
    const collector = FernNavigation.NodeCollector.collect(root);

    const pageNodes = collector.indexablePageNodesWithAuth.filter((node) => !isEffectivelyHidden(node, collector));

    const markdownNodes = pageNodes
        .filter((node) => !FernNavigation.isApiLeaf(node))
        .filter(FernNavigation.hasMarkdown);
    const apiLeafNodes = pageNodes.filter(FernNavigation.isApiLeaf);

    const markdownRecords = flatten(
        await Promise.all(
            markdownNodes.map(async (node): Promise<TurbopufferRecordWithoutVector[]> => {
                const pageId = FernNavigation.getPageId(node);
                if (!pageId) {
                    return [];
                }

                const markdown = pages[pageId];
                if (!markdown) {
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
            return;
        }

        const url = `https://${domain}${slugToHref(node.slug)}`;

        if (node.type === "endpoint") {
            const endpoint = apiDefinition.endpoints[node.endpointId];
            if (!endpoint) {
                return;
            }

            apiReferenceRecords.push(
                createEndpointBaseRecordHttp({
                    node,
                    parents: collector.getParents(node.id) ?? [],
                    authed: authed?.(node) ?? false,
                    endpoint,
                    url,
                    types: apiDefinition.types,
                    apiDefinition
                })
            );
            return;
        }

        if (node.type === "webSocket") {
            const endpoint = apiDefinition.websockets[node.webSocketId];
            if (!endpoint) {
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
