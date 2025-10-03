import { isNonNullish } from "@fern-api/ui-core-utils";

import { ResultItem } from "../types";
import { resultsToRanks } from "./results-to-ranks";

export function reciprocalRankFusion(bm25: ResultItem[], vector: ResultItem[], k: number = 60): ResultItem[] {
    const resultsById: Record<string | number, ResultItem> = {};
    bm25.forEach((item) => (resultsById[item.id] = item));
    vector.forEach((item) => (resultsById[item.id] = item));

    const bm25Ranks = resultsToRanks(bm25);
    const vectorRanks = resultsToRanks(vector);

    const scores: Record<string, number> = {};

    const allDocIds = new Set([...Object.keys(bm25Ranks), ...Object.keys(vectorRanks)]);

    allDocIds.forEach((docId) => {
        const bm25Rank = bm25Ranks[docId] ?? Infinity;
        const vectorRank = vectorRanks[docId] ?? Infinity;
        scores[docId] = 1.0 / (k + bm25Rank) + 1.0 / (k + vectorRank);
    });

    return Object.entries(scores)
        .map(([docId, score]) => ({ id: docId, score }))
        .sort((a, b) => b.score - a.score)
        .map(({ id }) => resultsById[id])
        .filter(isNonNullish);
}
