import { compact, flatten } from "es-toolkit/array";

import type { GrpcMethod } from "@fern-api/docs-utils";
import { ApiDefinition, type FernNavigation } from "@fern-api/fdr-sdk";
import { measureBytes, truncateToBytes, withDefaultProtocol } from "@fern-api/ui-core-utils";
import { maybePrepareMdxContent, toDescription } from "@fern-docs/search-utils";

import type { BaseRecord, EndpointBaseRecord } from "../types";

interface CreateEndpointBaseRecordGrpc {
    node: FernNavigation.GrpcNode;
    base: BaseRecord;
    grpc: ApiDefinition.EndpointDefinition;
    grpcMethodType: GrpcMethod;
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}

export function createEndpointBaseRecordGrpc({
    base,
    node,
    grpc,
    grpcMethodType,
    types
}: CreateEndpointBaseRecordGrpc): EndpointBaseRecord {
    const prepared = maybePrepareMdxContent(toDescription(grpc.description));
    const code_snippets = flatten(compact([base.code_snippets, prepared.code_snippets])).filter(
        (codeSnippet) => measureBytes(codeSnippet.code) < 2000
    );

    const keywords: string[] = base.keywords ? (Array.isArray(base.keywords) ? base.keywords : [base.keywords]) : [];

    keywords.push("grpc", "api", "protobuf", "proto", "json");

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
    }).endpoint(grpc, grpc.id);

    const endpoint_path = ApiDefinition.toColonEndpointPathLiteral(grpc.path);
    const endpoint_path_curly = ApiDefinition.toCurlyBraceEndpointPathLiteral(grpc.path);

    return {
        ...base,
        api_type: "grpc",
        api_definition_id: node.apiDefinitionId,
        api_endpoint_id: node.grpcId,
        distinct: node.grpcId,
        method: grpcMethodType,
        endpoint_path,
        endpoint_path_alternates: [
            endpoint_path_curly,
            ...(grpc.environments?.map((environment) =>
                String(new URL(endpoint_path, withDefaultProtocol(environment.baseUrl)))
            ) ?? []),
            ...(grpc.environments?.map((environment) =>
                String(new URL(endpoint_path_curly, withDefaultProtocol(environment.baseUrl)))
            ) ?? [])
        ],
        response_type: "binary",
        description: prepared.content != null ? truncateToBytes(prepared.content, 50 * 1000) : undefined,
        code_snippets: code_snippets.length > 0 ? code_snippets : undefined,
        availability: grpc.availability,
        environments: grpc.environments?.map((environment) => ({
            id: environment.id,
            url: environment.baseUrl
        })),
        default_environment_id: grpc.defaultEnvironment,
        keywords: keywords.length > 0 ? keywords : undefined
    };
}
