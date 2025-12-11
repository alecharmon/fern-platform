export interface KeywordAccumulator {
    add: (keyword: string | undefined) => void;
    values: () => string[];
}

export function createKeywordAccumulator(): KeywordAccumulator {
    const keywords = new Set<string>();
    const add = (keyword: string | undefined) => {
        if (keyword == null) {
            return;
        }
        const trimmed = keyword.trim();
        if (trimmed.length > 0) {
            keywords.add(trimmed);
        }
    };
    const values = () => Array.from(keywords);
    return { add, values };
}
