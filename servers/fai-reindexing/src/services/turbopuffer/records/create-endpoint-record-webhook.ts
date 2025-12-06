import { ApiDefinition, FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import { truncateToBytes } from "@fern-api/ui-core-utils";
import {
    createDelimitedRolesetString,
    createViewersForNodes,
    maybePrepareMdxContent,
    type TurbopufferRecord,
    toDescription
} from "@fern-docs/search-utils";
import { createHash } from "crypto";

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
    const prepared = maybePrepareMdxContent(toDescription(endpoint.description));

    const keywords: string[] = [];

    keywords.push("endpoint", "api", "webhook");

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
    }).webhookDefinition(endpoint, endpoint.id);

    const description = prepared.content != null ? truncateToBytes(prepared.content, 50 * 1000) : undefined;

    const document_body = JSON.stringify(
        {
            description,
            api_type: "webhook",
            api_definition_id: node.apiDefinitionId,
            api_endpoint_id: node.webhookId,
            method: node.method,
            endpoint_path: endpoint.path.join("")
        },
        null,
        2
    );

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    const document = `${document_body}\n\n${description}`;

    const breadcrumbs = FernNavigation.utils
        .createBreadcrumb([...parents, node])
        .map((b) => b.title)
        .join(", ");

    return {
        id: createHash("sha256").update(node.webhookId).digest("hex"),
        attributes: {
            chunk: prepared.content ?? "",
            title: node.title,
            document,
            url,
            version: versionNode?.title,
            product: productNode?.title,
            authed: isNodeAuthed,
            roles: roles.map((role) => createDelimitedRolesetString(role)),
            keywords,
            content_type: "webhook",
            breadcrumbs,
            chunk_index: 0,
            parent_id: node.webhookId,
            parent_content_hash: createHash("sha256").update(document).digest("hex")
        }
    };
}
