/**
 * Creates disambiguated display names for file paths.
 * When multiple files have the same filename, progressively adds parent directories
 * until each display name is unique.
 *
 * @example
 * Input: ["fern/apis/api1/openapi.yml", "fern/apis/api2/openapi.yml", "docs.yml"]
 * Output: Map {
 *   "fern/apis/api1/openapi.yml" => "api1/openapi.yml",
 *   "fern/apis/api2/openapi.yml" => "api2/openapi.yml",
 *   "docs.yml" => "docs.yml"
 * }
 */
export function getDisambiguatedFileNames(paths: string[]): Map<string, string> {
    const result = new Map<string, string>();

    // Start with just the filename for each path
    const segmentCounts = new Map<string, number>(); // path -> number of segments to show
    for (const path of paths) {
        segmentCounts.set(path, 1);
    }

    // Keep expanding until all display names are unique
    let hasConflicts = true;
    while (hasConflicts) {
        hasConflicts = false;

        // Build current display names
        const displayNames = new Map<string, string>();
        for (const path of paths) {
            const segments = path.split("/");
            const count = segmentCounts.get(path) || 1;
            const displayName = segments.slice(-count).join("/");
            displayNames.set(path, displayName);
        }

        // Find conflicts (paths with the same display name)
        const nameToPathsMap = new Map<string, string[]>();
        for (const [path, displayName] of displayNames) {
            const existing = nameToPathsMap.get(displayName) || [];
            existing.push(path);
            nameToPathsMap.set(displayName, existing);
        }

        // For each conflict, increase segment count for conflicting paths
        for (const [, conflictingPaths] of nameToPathsMap) {
            if (conflictingPaths.length > 1) {
                hasConflicts = true;
                for (const path of conflictingPaths) {
                    const segments = path.split("/");
                    const currentCount = segmentCounts.get(path) || 1;
                    // Only increase if we haven't reached the full path yet
                    if (currentCount < segments.length) {
                        segmentCounts.set(path, currentCount + 1);
                    }
                }
            }
        }
    }

    // Build final result
    for (const path of paths) {
        const segments = path.split("/");
        const count = segmentCounts.get(path) || 1;
        result.set(path, segments.slice(-count).join("/"));
    }

    return result;
}
