import { Turbopuffer } from "@turbopuffer/turbopuffer";

import { FacetFilter } from "@fern-docs/search-keyword";

import { TurbopufferRecord } from "../types";
import { buildQueryFilters } from "./query-filters";
import { reciprocalRankFusion } from "./reciprocal-rank-fusion";

interface SemanticSearchOptions {
  vectorizer: (text: string) => Promise<number[]>;
  namespace: string;
  apiKey: string;
  topK: number;
  filters?: FacetFilter[];
  explodedRoles: string[];

  /**
   * The search mode to use.
   * @default "semantic"
   */
  mode?: "semantic" | "bm25" | "hybrid";

  // ignore these document ids & urls; used to avoid tool-calls returning the same document over and over
  documentIdsToIgnore?: string[];
  urlsToIgnore?: string[];
}

export async function queryTurbopuffer(
  query: string,
  {
    vectorizer,
    namespace,
    apiKey,
    topK,
    filters,
    explodedRoles,
    mode = "hybrid",
    documentIdsToIgnore = [],
    urlsToIgnore = [],
  }: SemanticSearchOptions
): Promise<TurbopufferRecord[]> {
  const tpuf = new Turbopuffer({
    apiKey,
    baseUrl: "https://gcp-us-east4.turbopuffer.com",
  });
  const ns = tpuf.namespace(namespace);

  const vector = await vectorizer(query);

  const queryFilters = buildQueryFilters({
    filters: filters ?? [],
    explodedRoles,
    documentIdsToIgnore,
    urlsToIgnore,
  });

  const semanticResults =
    mode !== "bm25"
      ? await ns.query({
          vector,
          distance_metric: "cosine_distance",
          top_k: 1,
          include_attributes: true,
          filters: queryFilters,
        })
      : [];

  const bm25Results =
    mode !== "semantic" && query.length < 1024
      ? await ns.query({
          top_k: topK,
          include_attributes: true,
          filters: queryFilters,
          rank_by: [
            "Sum",
            [
              ["title", "BM25", query],
              ["keywords", "BM25", query],
            ],
          ],
        })
      : [];

  return reciprocalRankFusion(
    semanticResults,
    bm25Results
  ) as unknown as TurbopufferRecord[];
}
