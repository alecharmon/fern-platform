import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { htmlToMdx } from "@fern-docs/mdx";

import type { PreviousNavigationSnapshots } from "./migrations.types";
import {
    buildSlugToDocsYmlFilePath,
    type NavigationSnapshot as CurrentNavigationSnapshot,
    NAVIGATION_SNAPSHOT_SCHEMA_VERSION
} from "./types";

// Extract snapshot schemas to migrate from migrations.types.ts
type NavigationSnapshotsToMigrate = PreviousNavigationSnapshots[keyof PreviousNavigationSnapshots];

export function runMigrations(
    branchName: string,
    data: NavigationSnapshotsToMigrate,
    fromVersion: number
): CurrentNavigationSnapshot {
    let migrated: NavigationSnapshotsToMigrate | CurrentNavigationSnapshot = data;

    // Run each migration in sequence from the current version to the latest
    for (let version = fromVersion; version < NAVIGATION_SNAPSHOT_SCHEMA_VERSION; version++) {
        migrated = applyMigration(branchName, migrated, version);
    }

    return migrated as CurrentNavigationSnapshot;
}

function applyMigration(
    branchName: string,
    data: NavigationSnapshotsToMigrate,
    fromVersion: number
): NavigationSnapshotsToMigrate | CurrentNavigationSnapshot {
    // Migrate fromVersion to the next version in the sequence (looped over in runMigrations)
    switch (fromVersion) {
        case 0:
            return migrateV0ToV1(branchName, data as PreviousNavigationSnapshots["V0"]);
        case 1:
            return migrateV1ToV2(data as PreviousNavigationSnapshots["V1"]);
        default:
            console.warn(`Unknown schema version ${fromVersion}, skipping migration`);
            return data as CurrentNavigationSnapshot;
    }
}

/**
 * Migrates from schema V1 to V2.
 * Changes:
 * - Renames docsYmlChanges to navigationChanges
 * - Adds docsYmlFilePath to each navigation change (defaults to "docs.yml")
 * - Adds slugToDocsYmlFilePath field (new in V2)
 * - docsYmlBaseContent remains string | null (V2 also supports Map, but V1 data is always string | null)
 */
function migrateV1ToV2(oldData: PreviousNavigationSnapshots["V1"]): PreviousNavigationSnapshots["V2"] {
    // For V1 data, docsYmlBaseContent is always string | null (V2 also supports Map)
    // Note: "docs.yml" is the canonical key for the main file (not "fern/docs.yml"), per DocsYmlFilePath convention
    const docsYmlBaseContent = oldData.docsYmlBaseContent ? new Map([["docs.yml", oldData.docsYmlBaseContent]]) : null;

    // Migrate docsYmlChanges (V1) to navigationChanges (V2)
    // V2 changes require:
    // - docsYmlFilePath field (defaults to "docs.yml")
    // - insertionMode for "add_page" type (defaults to "append")
    const navigationChanges = new Map<
        string,
        PreviousNavigationSnapshots["V2"]["navigationChanges"] extends Map<string, infer T> ? T : never
    >();

    for (const [key, change] of oldData.docsYmlChanges.entries()) {
        if (change.type === "add_page") {
            // "add_page" in V2 requires insertionMode
            navigationChanges.set(key, {
                type: "add_page",
                sectionTitle: change.sectionTitle,
                tabSlug: change.tabSlug,
                pageEntry: change.pageEntry,
                insertionMode: "append", // Default insertion mode for migrated data
                createdAt: change.createdAt,
                committed: change.committed,
                docsYmlFilePath: "docs.yml"
            });
        } else if (change.type === "remove_page") {
            navigationChanges.set(key, {
                type: "remove_page",
                sectionTitle: change.sectionTitle,
                tabSlug: change.tabSlug,
                pageEntry: change.pageEntry,
                createdAt: change.createdAt,
                committed: change.committed,
                docsYmlFilePath: "docs.yml"
            });
        } else if (change.type === "rename_section") {
            navigationChanges.set(key, {
                type: "rename_section",
                sectionId: change.sectionId,
                oldTitle: change.oldTitle,
                newTitle: change.newTitle,
                tabSlug: change.tabSlug,
                createdAt: change.createdAt,
                committed: change.committed,
                docsYmlFilePath: "docs.yml"
            });
        }
    }

    return {
        schemaVersion: 2,
        branchName: oldData.branchName,
        metadata: oldData.metadata,
        pageRegistry: oldData.pageRegistry,
        docsYmlBaseContent,
        slugToDocsYmlFilePath: buildSlugToDocsYmlFilePath(docsYmlBaseContent), // Build from migrated content
        navigationChanges,
        lastCommittedHash: oldData.lastCommittedHash,
        rootNode: oldData.rootNode,
        version: oldData.version
    };
}

/** Migrates from schema V0  (f.k.a. StoredNavigationData) to V1 (NavigationSnapshot) */
function migrateV0ToV1(
    branchName: string,
    oldData: PreviousNavigationSnapshots["V0"]
): PreviousNavigationSnapshots["V1"] {
    const pageRegistry: PreviousNavigationSnapshots["V1"]["pageRegistry"] = {};
    const docsYmlChanges = new Map<string, any>();

    // Migrate pageContents to pageRegistry
    if (oldData.pageContents) {
        Object.entries(oldData.pageContents).forEach(([filename, content]) => {
            // Try to recover MDX from HTML using convert.ts
            let recoveredMdx = "";
            try {
                const { mdx } = htmlToMdx(content.html || "", {
                    frontmatter: content.frontmatter || {}
                });
                recoveredMdx = mdx;
            } catch (error) {
                console.warn(`Failed to recover MDX for ${filename}:`, error);
                // Fallback to empty MDX if conversion fails
                recoveredMdx = "";
            }

            // Attempt to reconstruct page data from contents x clientPages
            const clientPageData = oldData.clientPages?.[filename];

            // Use the filename without the extension as the fallback title and slug
            const filenameWithoutExt = filename.replace(/\.(md|mdx)$/, "");

            const foundNode: PreviousNavigationSnapshots["V1"]["pageRegistry"]["pageData"]["pageData"]["foundNode"] = {
                type: "found" as const,
                node: clientPageData?.node || {
                    type: "page",
                    id: (clientPageData?.node.id || filename) as FernNavigation.NodeId,
                    title: (clientPageData?.node.title || content.frontmatter?.title || filenameWithoutExt) as string,
                    slug: (clientPageData?.node.slug ||
                        content.frontmatter?.slug ||
                        filenameWithoutExt) as FernNavigation.Slug,
                    canonicalSlug: (clientPageData?.node.canonicalSlug ||
                        content.frontmatter?.canonicalSlug ||
                        filenameWithoutExt) as FernNavigation.Slug,
                    pageId: (clientPageData?.node.pageId || filename) as FernNavigation.PageId,
                    authed: undefined,
                    availability: undefined,
                    featureFlags: undefined,
                    hidden: undefined,
                    icon: undefined,
                    noindex: undefined,
                    orphaned: undefined,
                    viewers: undefined
                },
                parents: [], // V0 does not contain parents array
                sidebar: clientPageData?.sidebar,
                tabs: [], //V0 does not contain tabs array
                currentTab:
                    clientPageData?.navigationContext?.currentTab?.type === "tab" ||
                    clientPageData?.navigationContext?.currentTab?.type === "changelog"
                        ? clientPageData.navigationContext.currentTab
                        : undefined,
                currentVersion: clientPageData?.navigationContext?.currentVersion,
                currentProduct: clientPageData?.navigationContext?.currentProduct,
                isCurrentVersionDefault: clientPageData?.navigationContext?.isCurrentVersionDefault ?? false,
                isCurrentProductDefault: clientPageData?.navigationContext?.isCurrentProductDefault ?? false
            };

            pageRegistry[filename] = {
                pageData: {
                    source: content.pageType || "server",
                    filename,
                    mdx: recoveredMdx,
                    frontmatter: content.frontmatter || {},
                    html: content.html || "",
                    foundNode: foundNode
                },
                status: (
                    Array.isArray(oldData.committedFiles)
                        ? oldData.committedFiles.includes(filename)
                        : oldData.committedFiles?.has?.(filename)
                )
                    ? "committed"
                    : "changed",
                isMarkedForDeletion: false,
                lastModified: content.lastModified,
                // Try to recover parentSectionId from clientPages
                parentSectionId: clientPageData?.parentNodeId as FernNavigation.NodeId,
                // Set initialMdx to the recovered MDX value for reset functionality
                initialMdx: recoveredMdx
            };
        });
    }

    // Migrate docsYmlState.pendingUpdates to docsYmlChanges
    if (oldData.docsYmlState?.pendingUpdates) {
        Object.entries(oldData.docsYmlState.pendingUpdates).forEach(([path, update]) => {
            docsYmlChanges.set(path, {
                type: update.operation === "remove" ? "remove_page" : "add_page",
                sectionTitle: update.sectionTitle,
                tabSlug: update.tabSlug,
                pageEntry: update.pageEntry,
                createdAt: update.createdAt || Date.now()
            });
        });
    }

    return {
        schemaVersion: 1,
        branchName,
        metadata: {
            orgName: oldData.metadata?.orgName ?? "",
            docsUrl: oldData.metadata?.docsUrl ?? ""
        },
        pageRegistry,
        docsYmlBaseContent: oldData.docsYmlState?.baseContent ?? null,
        docsYmlChanges,
        lastCommittedHash: oldData.lastCommittedHash,
        version: 0
    };
}
