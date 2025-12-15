import { ApiDefinition, FernNavigation, type FernNavigation as FernNavigationType } from "@fern-api/fdr-sdk";
import {
    createDelimitedRolesetString,
    createViewersForNodes,
    endpointToMarkdown,
    type TurbopufferRecord
} from "@fern-docs/search-utils";
import { createHash } from "crypto";

import { buildEndpointSummary } from "./endpoint-summary";
import { createKeywordAccumulator } from "./keyword-utils";

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
    const chunk = buildEndpointSummary(node.title, endpoint, types);

    const keywords = createKeywordAccumulator();

    const colonPath = ApiDefinition.toColonEndpointPathLiteral(endpoint.path);
    const curlyPath = ApiDefinition.toCurlyBraceEndpointPathLiteral(endpoint.path);

    ["endpoint", "api", "http", "rest", "openapi"].forEach(keywords.add);
    keywords.add(node.title);
    keywords.add(endpoint.displayName);
    keywords.add(endpoint.operationId);
    keywords.add(endpoint.method);
    keywords.add(colonPath);
    keywords.add(curlyPath);
    keywords.add(`${endpoint.method} ${colonPath}`);
    keywords.add(`${endpoint.method} ${curlyPath}`);

    const response_type =
        endpoint.responses?.[0]?.body.type === "streamingText" || endpoint.responses?.[0]?.body.type === "stream"
            ? "stream"
            : endpoint.responses?.[0]?.body.type === "fileDownload"
              ? "file"
              : endpoint.responses?.[0]?.body != null
                ? "json"
                : undefined;

    if (response_type != null) {
        keywords.add(response_type);
    }

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
        FormDataFile: (file) => {
            keywords.add(file.key);
            return file;
        },
        FormDataFiles: (files) => {
            keywords.add(files.key);
            return files;
        }
    }).endpoint(endpoint, endpoint.id);

    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const document = endpointToMarkdown(endpoint, node, domain, apiDefinition);

    const { roles, authed: isNodeAuthed } = createViewersForNodes([...parents, node], authed);

    const breadcrumbs = FernNavigation.utils
        .createBreadcrumb([...parents, node])
        .map((b) => b.title)
        .join(", ");

    return {
        id: createHash("sha256").update(node.id).digest("hex"),
        attributes: {
            title: node.title,
            chunk,
            document,
            url,
            product: productNode?.title,
            version: versionNode?.title,
            authed: isNodeAuthed,
            roles: roles.map((role) => createDelimitedRolesetString(role)),
            keywords: keywords.values(),
            content_type: "endpoint",
            breadcrumbs,
            chunk_index: 0,
            parent_id: node.endpointId,
            parent_content_hash: createHash("sha256").update(document).digest("hex")
        }
    };
}
