import { pageDataToMdx } from "./mdxUtils";
import type { ConfigChange, PageChange, StoredNavigationData } from "./types";
import { buildDocsYmlWithUpdates } from "./ymlUtils";

export function createCommitFromChanges(
    pageChanges: Map<string, PageChange>,
    configChanges: Map<string, ConfigChange>,
    navigationData: StoredNavigationData,
    changedMdxFiles?: Record<string, string>
) {
    const changedFiles: Record<string, string> = {};
    const deletedFiles: string[] = [];

    pageChanges.forEach((change) => {
        if (change.type === "delete") {
            deletedFiles.push(change.filename);
        } else if (change.pageData) {
            changedFiles[change.filename] = pageDataToMdx(change.pageData);
        }
    });

    // Include changed MDX files from the editor (and exclude deleted files)
    if (changedMdxFiles) {
        Object.entries(changedMdxFiles).forEach(([filename, content]) => {
            if (typeof content === "string" && !deletedFiles.includes(filename)) {
                changedFiles[filename] = content;
            }
        });
    }

    // Generate docs.yml content if there are config changes
    const docsYmlContent = configChanges.size > 0 ? buildDocsYmlWithUpdates(navigationData) : undefined;
    if (docsYmlContent) {
        changedFiles["docs.yml"] = docsYmlContent;
    }

    return { changedFiles, deletedFiles, docsYmlContent };
}

export function handleCommitSuccess(allFilesToCommit: Record<string, string>): Partial<StoredNavigationData> {
    return {
        committedFiles: new Set(Object.keys(allFilesToCommit).filter((f) => f.endsWith(".mdx"))),
        docsYmlState: {
            baseContent: allFilesToCommit["docs.yml"] || "",
            pendingUpdates: {},
            lastFetched: Date.now()
        },
        lastCommittedHash: generateSimpleHash(allFilesToCommit)
    };
}

export function generateSimpleHash(content: Record<string, string>): string {
    const sortedKeys = Object.keys(content).sort();
    const sortedChanges: Record<string, string> = {};
    sortedKeys.forEach((key) => {
        const value = content[key];
        if (value !== undefined) {
            sortedChanges[key] = value;
        }
    });

    const changeString = JSON.stringify(sortedChanges);
    let hash = 0;
    for (let i = 0; i < changeString.length; i++) {
        const char = changeString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return hash.toString();
}
