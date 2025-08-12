import { EmbeddingModel } from "ai";

import { withoutStaging } from "@fern-api/docs-utils";

export function getTurbopufferNamespace(
  domain: string,
  embeddingModel: EmbeddingModel<string>
): string {
  return `${withoutStaging(domain)}_${embeddingModel.modelId}_v3`;
}
