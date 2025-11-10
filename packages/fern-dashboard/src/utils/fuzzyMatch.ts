import Fuse from "fuse.js";

/**
 * Find the best matching path from a list of valid paths using Fuse.js
 * This provides better fuzzy matching than simple Levenshtein distance,
 * especially for path-like strings where common prefixes matter.
 */
export function findBestMatch(
    invalidPath: string,
    validPaths: string[],
    threshold: number = 0.4
): { path: string; score: number } | null {
    if (validPaths.length === 0) {
        return null;
    }

    // Configure Fuse.js for path matching
    const fuse = new Fuse(validPaths, {
        includeScore: true,
        threshold: 1 - threshold, // Fuse uses 0 (exact) to 1 (anything), we use opposite
        ignoreLocation: false, // Location matters for paths
        distance: 100, // Allow some flexibility in character position
        minMatchCharLength: 2,
        keys: [], // We're searching the strings directly
        useExtendedSearch: false
    });

    const results = fuse.search(invalidPath);

    if (results.length === 0) {
        return null;
    }

    // Fuse returns score where 0 is perfect match, 1 is no match
    // Convert to our format where 1 is perfect match, 0 is no match
    const bestResult = results[0];
    if (!bestResult) {
        return null;
    }

    return {
        path: bestResult.item,
        score: 1 - (bestResult.score ?? 1)
    };
}

/**
 * Find top N matching paths from a list of valid paths using Fuse.js
 */
export function findTopMatches(
    invalidPath: string,
    validPaths: string[],
    topN: number = 10,
    threshold: number = 0.3
): { path: string; score: number }[] {
    if (validPaths.length === 0) {
        return [];
    }

    const fuse = new Fuse(validPaths, {
        includeScore: true,
        threshold: 0.6,
        keys: []
    });

    const results = fuse.search(invalidPath);

    // Convert and filter results
    return results
        .slice(0, topN)
        .map((result) => ({
            path: result.item,
            score: 1 - (result.score ?? 1)
        }))
        .filter((result) => result.score >= threshold);
}
