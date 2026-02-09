import { ApiDefinition, FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import { createViewersForNodes, type TurbopufferRecord } from "@fern-docs/search-utils";
import { createHash } from "crypto";

import { buildWebhookSummary } from "./endpoint-summary";
import { createKeywordAccumulator } from "./keyword-utils";

export function createEndpointBaseRecordWebhook({
    parents,
    authed,
    node,
    endpoint,
    url,
    types
}: {
    node: FernNavigationType.WebhookNode;
    parents: readonly FernNavigationType.NavigationNodeParent[];
    authed: boolean;
    endpoint: ApiDefinition.WebhookDefinition;
    url: string;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}): TurbopufferRecord {
    const versionNode = parents.find((n): n is FernNavigationType.VersionNode => n.type === "version");
    const productNode = parents.find((n): n is FernNavigationType.ProductNode => n.type === "product");
    const chunk = buildWebhookSummary(node.title, node, endpoint, types);

    const keywords = createKeywordAccumulator();

    const webhookPath = endpoint.path.join("");

    ["endpoint", "api", "webhook"].forEach(keywords.add);
    keywords.add(node.title);
    keywords.add(endpoint.displayName);
    keywords.add(endpoint.operationId);
    keywords.add(node.method);
    keywords.add(webhookPath);
    keywords.add(`${node.method} ${webhookPath}`);

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
        }
    }).webhookDefinition(endpoint, endpoint.id);

    const document_body = JSON.stringify(
        {
            api_type: "webhook",
            api_definition_id: node.apiDefinitionId,
            api_endpoint_id: node.webhookId,
            method: node.method,
            endpoint_path: webhookPath
        },
        null,
        2
    );

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    const document = `${document_body}\n\n${chunk}`;

    const breadcrumbs = FernNavigation.utils
        .createBreadcrumb([...parents, node])
        .map((b) => b.title)
        .join(", ");

    return {
        id: createHash("sha256").update(node.webhookId).digest("hex"),
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
            content_type: "webhook",
            breadcrumbs,
            chunk_index: 0,
            parent_id: node.webhookId,
            parent_content_hash: createHash("sha256").update(document).digest("hex")
        }
    };
}
