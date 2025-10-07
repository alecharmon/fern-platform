/**
 * Filename to content map
 * @example { "pages/getting-started.mdx": "# Getting Started\n...", "docs.yml": "..." }
 */
export type FilenameToContent = Record<string, string>;

/** File format for GitHub commit API */
export type GitCommitFile = { path: string; content: string; mode: "100644" } | { path: string; delete: true };

/** Computes a hash of the files in FilenameToContent */
export function computeStateHash(files: FilenameToContent): string {
    const sortedKeys = Object.keys(files).sort();
    const sortedChanges: Record<string, string> = {};
    sortedKeys.forEach((key) => {
        const value = files[key];
        if (value !== undefined) {
            sortedChanges[key] = value;
        }
    });

    const changeString = JSON.stringify(sortedChanges);

    // Simple hash function (not cryptographic, just for tracking)
    let hash = 0;
    for (let i = 0; i < changeString.length; i++) {
        const char = changeString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
}

/** Checks if files already committed by comparing hash against last committed hash */
export function hasChangesToCommit(changedFiles: FilenameToContent, lastCommittedHash?: string): boolean {
    // If there are no changes at all, return false (everything is committed)
    if (Object.keys(changedFiles).length === 0) {
        return false;
    }

    // Check if the current state matches the last committed hash
    const currentHash = computeStateHash(changedFiles);
    return currentHash !== lastCommittedHash;
}

/** Format git files for commit API payload */
export function formatCommitFiles(
    changedFiles: FilenameToContent,
    deletedFilePaths: string[],
    pathPrefix: string = "fern/"
): GitCommitFile[] {
    return [
        // Files to commit/update
        ...Object.entries(changedFiles).map(([filePath, content]) => ({
            path: `${pathPrefix}${filePath}`,
            content,
            mode: "100644" as const
        })),
        // Files to delete
        ...deletedFilePaths.map((filePath: string) => ({
            path: `${pathPrefix}${filePath}`,
            delete: true as const
        }))
    ];
}
