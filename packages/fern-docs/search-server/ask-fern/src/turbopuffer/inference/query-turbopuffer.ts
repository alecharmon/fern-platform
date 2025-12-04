import type { FacetFilter } from "@fern-docs/search-keyword";
import type { TurbopufferRecord } from "@fern-docs/search-utils";
import { Turbopuffer } from "@turbopuffer/turbopuffer";

import { measureAsync } from "../../utils/measure-async";
import { buildQueryFilters } from "./query-filters";
import { reciprocalRankFusion } from "./reciprocal-rank-fusion";

export interface TurbopufferAuthError {
    error: "unauthorized";
    message: string;
    requiresAuth: true;
}

export interface TurbopufferQueryMetrics {
    durationMs: number;
    mode: "semantic" | "bm25" | "hybrid";
    numResults: number;
    semanticQueryDurationMs?: number;
    bm25QueryDurationMs?: number;
    embeddingDurationMs?: number;
}

export type TurbopufferQueryResult = TurbopufferRecord[] | TurbopufferAuthError;

export interface TurbopufferQueryResultWithMetrics {
    result: TurbopufferQueryResult;
    metrics: TurbopufferQueryMetrics;
}

export function isAuthError(result: TurbopufferQueryResult): result is TurbopufferAuthError {
    return Array.isArray(result) === false && "error" in result && result.error === "unauthorized";
}

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

    // include only these specific documents
    documentUrls?: string[];
    userIsAuthed: boolean;
}

export async function queryTurbopuffer(
    query: string,
    options: SemanticSearchOptions
): Promise<TurbopufferQueryResultWithMetrics> {
    const {
        vectorizer,
        namespace,
        apiKey,
        topK,
        filters,
        explodedRoles,
        mode = "hybrid",
        documentIdsToIgnore = [],
        urlsToIgnore = [],
        documentUrls,
        userIsAuthed
    } = options;

    const startTime = Date.now();

    const tpuf = new Turbopuffer({
        apiKey,
        baseUrl: "https://gcp-us-east4.turbopuffer.com"
    });
    const ns = tpuf.namespace(namespace);

    const queryFilters = buildQueryFilters({
        filters: filters ?? [],
        explodedRoles,
        documentIdsToIgnore,
        urlsToIgnore,
        documentUrls,
        userIsAuthed
    });

    if (documentUrls?.length) {
        const results = await ns.query({
            filters: queryFilters,
            include_attributes: true
        });
        const resultArray = results as unknown as TurbopufferRecord[];
        return {
            result: resultArray,
            metrics: {
                durationMs: Date.now() - startTime,
                mode,
                numResults: results.length
            }
        };
    }

    const [vector, embeddingDurationMs] = await measureAsync(() => vectorizer(query));

    const [semanticResults, semanticQueryDurationMs] =
        mode !== "bm25"
            ? await measureAsync(() =>
                  ns.query({
                      vector,
                      distance_metric: "cosine_distance",
                      top_k: topK,
                      include_attributes: true,
                      filters: queryFilters
                  })
              )
            : [[], undefined];

    const [bm25Results, bm25QueryDurationMs] =
        mode !== "semantic" && query.length < 1024
            ? await measureAsync(() =>
                  ns.query({
                      top_k: topK,
                      include_attributes: true,
                      filters: queryFilters,
                      rank_by: [
                          "Sum",
                          [
                              ["title", "BM25", query],
                              ["keywords", "BM25", query]
                          ]
                      ]
                  })
              )
            : [[], undefined];

    const result = reciprocalRankFusion(semanticResults, bm25Results) as unknown as TurbopufferRecord[];

    return {
        result,
        metrics: {
            durationMs: Date.now() - startTime,
            mode,
            numResults: result.length,
            semanticQueryDurationMs,
            bm25QueryDurationMs,
            embeddingDurationMs
        }
    };
}
