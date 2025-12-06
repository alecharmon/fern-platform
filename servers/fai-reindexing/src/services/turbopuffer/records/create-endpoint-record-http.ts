import { ApiDefinition, FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import {
    createDelimitedRolesetString,
    createViewersForNodes,
    endpointToMarkdown,
    maybePrepareMdxContent,
    type TurbopufferRecord,
    toDescription
} from "@fern-docs/search-utils";
import { createHash } from "crypto";

export function createEndpointBaseRecordHttp({
    node,
    parents,
    authed,
    endpoint,
    url,
    types,
    apiDefinition
}: {
    node: FernNavigationType.EndpointNode;
    parents: readonly FernNavigationType.NavigationNodeParent[];
    authed: boolean;
    endpoint: ApiDefinition.EndpointDefinition;
    url: string;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
    apiDefinition?: ApiDefinition.ApiDefinition;
}): TurbopufferRecord {
    const versionNode = parents.find((n): n is FernNavigationType.VersionNode => n.type === "version");
    const productNode = parents.find((n): n is FernNavigationType.ProductNode => n.type === "product");
    const prepared = maybePrepareMdxContent(toDescription(endpoint.description));

    const keywords: string[] = [];

    keywords.push("endpoint", "api", "http", "rest", "openapi");

    const response_type =
        endpoint.responses?.[0]?.body.type === "streamingText" || endpoint.responses?.[0]?.body.type === "stream"
            ? "stream"
            : endpoint.responses?.[0]?.body.type === "fileDownload"
              ? "file"
              : endpoint.responses?.[0]?.body != null
                ? "json"
                : undefined;

    if (response_type != null) {
        keywords.push(response_type);
    }

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
    }).endpoint(endpoint, endpoint.id);

    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const document = endpointToMarkdown(endpoint, node, domain, apiDefinition);

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    const breadcrumbs = FernNavigation.utils.createBreadcrumb([...parents, node]).map((b) => b.title);

    return {
        id: createHash("sha256").update(node.id).digest("hex"),
        attributes: {
            title: node.title,
            chunk: prepared.content ?? "",
            document,
            url,
            product: productNode?.title,
            version: versionNode?.title,
            authed: isNodeAuthed,
            roles: roles.map((role) => createDelimitedRolesetString(role)),
            keywords,
            content_type: "endpoint",
            breadcrumbs,
            chunk_index: 0,
            parent_id: node.endpointId,
            parent_content_hash: createHash("sha256").update(document).digest("hex")
        }
    };
}
