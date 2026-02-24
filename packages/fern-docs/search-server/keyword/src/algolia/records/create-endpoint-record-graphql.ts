import { ApiDefinition, type FernNavigation } from "@fern-api/fdr-sdk";
import { measureBytes, truncateToBytes } from "@fern-api/ui-core-utils";
import { maybePrepareMdxContent, toDescription } from "@fern-docs/search-utils";
import { compact, flatten } from "es-toolkit/array";

import type { BaseRecord, EndpointBaseRecord } from "../types";

interface CreateEndpointBaseRecordGraphQl {
    node: FernNavigation.GraphQlNode;
    base: BaseRecord;
    graphqlOperation: ApiDefinition.GraphQlOperation;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createEndpointBaseRecordGraphQl({
    base,
    node,
    graphqlOperation,
    types
}: CreateEndpointBaseRecordGraphQl): EndpointBaseRecord {
    const prepared = maybePrepareMdxContent(toDescription(graphqlOperation.description ?? undefined));
    const code_snippets = flatten(compact([base.code_snippets, prepared.code_snippets])).filter(
        (codeSnippet) => measureBytes(codeSnippet.code) < 2000
    );

    const keywords: string[] = base.keywords ? (Array.isArray(base.keywords) ? base.keywords : [base.keywords]) : [];

    keywords.push("graphql", "api", graphqlOperation.operationType.toLowerCase());

    const transformer = ApiDefinition.Transformer.with({
        TypeShape: (type) => {
            if (type.type === "alias" && type.value.type === "id") {
                const definition = types[type.value.id];
                if (definition != null) {
                    keywords.push(definition.name);
                }
            }
            return type;
        }
    });

    // Transform argument types and return type to extract type names
    graphqlOperation.arguments?.forEach((arg) => {
        transformer.typeShape(arg.type, arg.name);
    });
    transformer.typeShape(graphqlOperation.returnType, "returnType");

    return {
        ...base,
        api_type: "graphql",
        api_definition_id: node.apiDefinitionId,
        api_endpoint_id: node.graphqlOperationId,
        distinct: node.graphqlOperationId,
        method: graphqlOperation.operationType,
        endpoint_path: graphqlOperation.name,
        endpoint_path_alternates: graphqlOperation.displayName ? [graphqlOperation.displayName] : undefined,
        description: prepared.content != null ? truncateToBytes(prepared.content, 50 * 1000) : undefined,
        code_snippets: code_snippets.length > 0 ? code_snippets : undefined,
        availability: graphqlOperation.availability ?? undefined,
        keywords: keywords.length > 0 ? keywords : undefined
    };
}
