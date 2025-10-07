import { generateKeyBetween } from "fractional-indexing";

/**
 * Compares fractional indexes: indexed items sort ascending, non-indexed maintain order
 * @see https://github.com/rocicorp/fractional-indexing
 * */
export function compareByFractionalIndex(aIndex: string | null | undefined, bIndex: string | null | undefined): number {
    if (aIndex != null && bIndex != null) {
        return aIndex < bIndex ? -1 : aIndex > bIndex ? 1 : 0;
    }
    if (aIndex != null) return -1;
    if (bIndex != null) return 1;
    return 0;
}

/** Generates fractional index at a given position */
export function generateFractionalIndex(
    indices: string[],
    insertPosition: "start" | "end" | { after: string } | { before: string }
): string {
    // Ensure indices are sorted
    const sortedIndices = [...indices].sort(compareByFractionalIndex);

    if (insertPosition === "start") {
        return generateKeyBetween(null, sortedIndices.at(0));
    }

    if (insertPosition === "end") {
        return generateKeyBetween(sortedIndices.at(-1), null);
    }

    if (typeof insertPosition === "object") {
        if ("after" in insertPosition) {
            const targetIndex = insertPosition.after;
            const currentPos = sortedIndices.indexOf(targetIndex);

            if (currentPos !== -1) {
                const prevIndex = targetIndex;
                const nextIndex = sortedIndices.at(currentPos + 1);
                return generateKeyBetween(prevIndex, nextIndex);
            }
        }

        if ("before" in insertPosition) {
            const targetIndex = insertPosition.before;
            const currentPos = sortedIndices.indexOf(targetIndex);

            if (currentPos !== -1) {
                const prevIndex = sortedIndices.at(currentPos - 1);
                const nextIndex = targetIndex;
                return generateKeyBetween(prevIndex, nextIndex);
            }
        }
    }

    return generateKeyBetween(null, undefined);
}
