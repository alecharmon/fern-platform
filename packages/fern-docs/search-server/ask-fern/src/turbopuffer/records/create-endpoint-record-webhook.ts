import { createHash } from "crypto";

import { ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import { truncateToBytes } from "@fern-api/ui-core-utils";
import { maybePrepareMdxContent, toDescription } from "@fern-docs/search-utils";

import { TurbopufferRecord } from "../types";

export function createEndpointBaseRecordWebhook({
  parents,
  authed,
  node,
  endpoint,
  url,
  types,
}: {
  node: FernNavigation.WebhookNode;
  parents: readonly FernNavigation.NavigationNodeParent[];
  authed: boolean;
  endpoint: ApiDefinition.WebhookDefinition;
  url: string;
  types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>;
}): TurbopufferRecord {
  const versionNode = parents.find(
    (n): n is FernNavigation.VersionNode => n.type === "version"
  );
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
    },
  }).webhookDefinition(endpoint, endpoint.id);

  const description =
    prepared.content != null
      ? truncateToBytes(prepared.content, 50 * 1000)
      : undefined;

  const document_body = JSON.stringify(
    {
      description,
      api_type: "webhook",
      api_definition_id: node.apiDefinitionId,
      api_endpoint_id: node.webhookId,
      method: node.method,
      endpoint_path: endpoint.path.join(""),
    },
    null,
    2
  );

  const document = `${document_body}\n\n${description}`;

  return {
    id: createHash("sha256").update(node.webhookId).digest("hex"),
    attributes: {
      chunk: prepared.content ?? "",
      title: node.title,
      document,
      url,
      version: versionNode?.title,
      authed,
      keywords,
    },
  };
}
