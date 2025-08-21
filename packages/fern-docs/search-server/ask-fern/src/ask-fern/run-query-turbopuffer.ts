import { EmbeddingModel } from "ai";
import { embed } from "ai";

import { turbopufferApiKey } from "@fern-api/docs-server/env-variables";
import { FacetFilter } from "@fern-docs/search-keyword";

import { queryTurbopuffer } from "../turbopuffer";

export async function runQueryTurbopuffer(
  query: string | null | undefined,
  opts: {
    embeddingModel: EmbeddingModel<string>;
    namespace: string;
    topK?: number;
    filters?: FacetFilter[];
    documentIdsToIgnore?: string[];
    urlsToIgnore?: string[];
  }
) {
  return query == null || query.trimStart().length === 0
    ? []
    : await queryTurbopuffer(query, {
        namespace: opts.namespace,
        apiKey: turbopufferApiKey(),
        topK: opts.topK ?? 5,
        vectorizer: async (text) => {
          const embedding = await embed({
            model: opts.embeddingModel,
            value: text,
          });
          return embedding.embedding;
        },
        filters: opts.filters,
        documentIdsToIgnore: opts.documentIdsToIgnore,
        urlsToIgnore: opts.urlsToIgnore,
      });
}
