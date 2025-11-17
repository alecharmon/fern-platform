/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) {
        const row = dp[i];
        if (row) {
            row[0] = i;
        }
    }
    for (let j = 0; j <= n; j++) {
        const cell = dp[0];
        if (cell) {
            cell[j] = j;
        }
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const prevRow = dp[i - 1];
            const currRow = dp[i];
            const prevCell = currRow?.[j - 1];
            if (str1[i - 1] === str2[j - 1] && prevRow && currRow) {
                currRow[j] = prevRow[j - 1] ?? 0;
            } else if (prevRow && currRow && prevCell !== undefined) {
                currRow[j] = Math.min((prevRow[j - 1] ?? 0) + 1, prevCell + 1, (prevRow[j] ?? 0) + 1);
            }
        }
    }

    return dp[m]?.[n] ?? 0;
}

/**
 * Calculate similarity score between two paths (0-1, where 1 is identical)
 */
function pathSimilarity(path1: string, path2: string): number {
    const normalizedPath1 = path1.toLowerCase().replace(/^\/+|\/+$/g, "");
    const normalizedPath2 = path2.toLowerCase().replace(/^\/+|\/+$/g, "");

    if (normalizedPath1 === normalizedPath2) {
        return 1;
    }

    const distance = levenshteinDistance(normalizedPath1, normalizedPath2);
    const maxLength = Math.max(normalizedPath1.length, normalizedPath2.length);

    if (maxLength === 0) {
        return 1;
    }

    return 1 - distance / maxLength;
}

/**
 * Calculate a comprehensive similarity score between paths
 * Takes into account:
 * - Overall string similarity
 * - Path segment overlap
 * - Substring matching
 */
export function calculatePathSimilarity(requestedPath: string, targetPath: string): number {
    const normalizedRequested = requestedPath.toLowerCase().replace(/^\/+|\/+$/g, "");
    const normalizedTarget = targetPath.toLowerCase().replace(/^\/+|\/+$/g, "");

    if (normalizedRequested === normalizedTarget) {
        return 1;
    }

    const requestedSegments = normalizedRequested.split("/").filter((s) => s.length > 0);
    const targetSegments = normalizedTarget.split("/").filter((s) => s.length > 0);

    let segmentMatchScore = 0;
    if (requestedSegments.length > 0 && targetSegments.length > 0) {
        const matchingSegments = requestedSegments.filter((seg) => targetSegments.includes(seg)).length;
        segmentMatchScore = matchingSegments / Math.max(requestedSegments.length, targetSegments.length);
    }

    const substringScore =
        normalizedTarget.includes(normalizedRequested) || normalizedRequested.includes(normalizedTarget) ? 0.3 : 0;

    const overallSimilarity = pathSimilarity(normalizedRequested, normalizedTarget);

    return overallSimilarity * 0.5 + segmentMatchScore * 0.3 + substringScore * 0.2;
}

/**
 * Find the most similar paths from a list of available paths
 * Deduplicates by href to avoid showing the same URL multiple times
 */
export function findSimilarPaths(
    requestedPath: string,
    availablePaths: { slug: string; title: string; href: string; subtitle?: string }[],
    limit = 3
): { slug: string; title: string; href: string; score: number; subtitle?: string }[] {
    const scoredPaths = availablePaths.map((path) => ({
        ...path,
        score: calculatePathSimilarity(requestedPath, path.slug)
    }));

    const sortedPaths = scoredPaths.sort((a, b) => b.score - a.score);

    const seenHrefs = new Set<string>();
    const uniquePaths: { slug: string; title: string; href: string; score: number; subtitle?: string }[] = [];

    for (const path of sortedPaths) {
        if (!seenHrefs.has(path.href)) {
            seenHrefs.add(path.href);
            uniquePaths.push(path);
            if (uniquePaths.length >= limit) {
                break;
            }
        }
    }

    return uniquePaths;
}
