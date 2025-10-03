import { ResultItem } from "../types";

export function resultsToRanks(results: ResultItem[]): Record<string, number> {
    return results.reduce<Record<string, number>>((acc, item, index) => {
        acc[item.id] = index + 1;
        return acc;
    }, {});
}
