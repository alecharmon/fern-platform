import {
  FilterCondition,
  Filters,
  Turbopuffer,
} from "@turbopuffer/turbopuffer";

import { FacetFilter } from "@fern-docs/search-keyword";

import { TurbopufferRecord } from "../types";
import { reciprocalRankFusion } from "./reciprocal-rank-fusion";

interface SemanticSearchOptions {
  vectorizer: (text: string) => Promise<number[]>;
  namespace: string;
  apiKey: string;
  topK: number;
  filters?: FacetFilter[];

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

  const documentIdFilters: FilterCondition[] = documentIdsToIgnore.map((id) => [
    "id",
    "NotEq",
    id,
  ]);

  const urlFilters: FilterCondition[] = urlsToIgnore.map((url) => [
    "url",
    "NotEq",
    url,
  ]);

  const versionFilters = filters
    ? filters.filter((f) => f.facet === "version.title")
    : [];

  const queryFilters: Filters | undefined =
    versionFilters.length > 0
      ? [
          "And",
          [
            ...versionFilters.map((f) => {
              const filter: Filters = [
                "Or",
                [
                  // TODO(eden): facet filters modify the case of the value (which leads to mismatches with the
                  // display name property (e.g., V1 -> v1)). Remove when we have a better way to handle this.
                  ["version", "Eq", f.value],
                  ["version", "Eq", f.value.toUpperCase()],
                  ["version", "Eq", f.value.toLowerCase()],
                  ["version", "Eq", null],
                ],
              ];
              return filter;
            }),
            ...documentIdFilters,
            ...urlFilters,
          ],
        ]
      : documentIdFilters.length > 0
        ? documentIdFilters.length === 1
          ? documentIdFilters[0]
          : ["And", documentIdFilters]
        : undefined;

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
