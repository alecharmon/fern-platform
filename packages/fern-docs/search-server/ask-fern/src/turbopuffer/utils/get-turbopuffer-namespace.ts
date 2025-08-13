import { EmbeddingModel } from "ai";

import { withoutStaging } from "@fern-api/docs-utils";

export function getTurbopufferNamespace(
  domain: string,
  indexName: string
): string {
  return `${withoutStaging(domain)}_${indexName}`;
}

export function getDocsIndexName(
  embeddingModel: EmbeddingModel<string>
): string {
  return `${embeddingModel.modelId}_v3`;
}

export function getQueryIndexName(): string {
  return `query`;
}
