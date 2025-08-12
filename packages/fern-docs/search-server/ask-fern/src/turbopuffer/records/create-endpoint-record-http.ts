import { createHash } from "crypto";
import { flatten } from "es-toolkit/array";

import { ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { maybePrepareMdxContent, toDescription } from "@fern-docs/search-utils";

import { TurbopufferRecord } from "../types";

interface RequestProperty {
  key: string;
  type: string;
  description?: string;
}

export function createEndpointBaseRecordHttp({
  node,
  parents,
  authed,
  endpoint,
  url,
  types,
}: {
  node: FernNavigation.EndpointNode;
  parents: readonly FernNavigation.NavigationNodeParent[];
  authed: boolean;
  endpoint: ApiDefinition.EndpointDefinition;
  url: string;
  types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}): TurbopufferRecord {
  const versionNode = parents.find(
    (n): n is FernNavigation.VersionNode => n.type === "version"
  );
  const prepared = maybePrepareMdxContent(toDescription(endpoint.description));

  const requestProperties: RequestProperty[] = [];
  endpoint.requests?.forEach((request) => {
    if (request.body.type === "object") {
      request.body.properties.forEach((property) => {
        const stringifiedProperty = maybeGetStringifiedProperty({
          property,
          types,
        });
        requestProperties.push({
          key: property.key.toString(),
          type: stringifiedProperty,
          description: property.description,
        });
      });
    }
  });
  let description = JSON.stringify(requestProperties, null, 2);

  const keywords: string[] = [];

  keywords.push("endpoint", "api", "http", "rest", "openapi");

  const response_type =
    endpoint.responses?.[0]?.body.type === "streamingText" ||
    endpoint.responses?.[0]?.body.type === "stream"
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
    },
  }).endpoint(endpoint, endpoint.id);

  const endpoint_path = ApiDefinition.toColonEndpointPathLiteral(endpoint.path);
  const endpoint_path_curly = ApiDefinition.toCurlyBraceEndpointPathLiteral(
    endpoint.path
  );

  const document_body = JSON.stringify(
    {
      description,
      code_snippets: prepared.code_snippets?.map(
        (code_snippet) => code_snippet.code
      ),
      api_type: "http",
      method: node.method,
      endpoint_path,
      endpoint_path_alternates: [
        endpoint_path_curly,
        ...(endpoint.environments?.map((environment) =>
          String(
            new URL(endpoint_path, withDefaultProtocol(environment.baseUrl))
          )
        ) ?? []),
        ...(endpoint.environments?.map((environment) =>
          String(
            new URL(
              endpoint_path_curly,
              withDefaultProtocol(environment.baseUrl)
            )
          )
        ) ?? []),
      ],
      response_type,
      environments: flatten(
        endpoint.environments?.map((environment) => [
          environment.id,
          environment.baseUrl,
        ]) ?? []
      ),
      default_environment_id: endpoint.defaultEnvironment,
    },
    null,
    2
  );

  const {
    content: request_description,
    code_snippets: request_description_code_snippets,
  } = maybePrepareMdxContent(
    toDescription(endpoint.requests?.[0]?.description)
  );

  if (
    request_description != null ||
    request_description_code_snippets?.length
  ) {
    description = request_description != null ? request_description : "";
  }

  const { content: response_description } = maybePrepareMdxContent(
    toDescription(endpoint.responses?.[0]?.description)
  );

  if (response_description != null) {
    if (description != null) {
      description += "\n\n" + response_description;
    } else {
      description = response_description;
    }
  }

  const document = `${document_body}\n\n${description}`;

  return {
    id: createHash("sha256").update(node.id).digest("hex"),
    attributes: {
      title: node.title,
      chunk: prepared.content ?? "",
      document,
      url,
      version: versionNode?.title,
      authed,
      keywords,
    },
  };
}

function maybeGetStringifiedProperty({
  property,
  types,
}: {
  property: ApiDefinition.ObjectProperty;
  types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}): string {
  const propertyValueShape = property.valueShape;
  if (propertyValueShape.type === "alias") {
    if (propertyValueShape.value.type === "id") {
      return JSON.stringify(types[propertyValueShape.value.id]);
    } else if (propertyValueShape.value.type === "optional") {
      if (
        propertyValueShape.value.shape.type === "alias" &&
        propertyValueShape.value.shape.value.type === "id"
      ) {
        return JSON.stringify(types[propertyValueShape.value.shape.value.id]);
      }
    }
    return JSON.stringify(propertyValueShape);
  } else if (propertyValueShape.type === "enum") {
    return JSON.stringify(propertyValueShape);
  }
  return JSON.stringify(propertyValueShape);
}
