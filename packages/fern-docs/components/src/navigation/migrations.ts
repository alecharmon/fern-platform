import type * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { htmlToMdx } from "@fern-docs/mdx";

import type { NavigationSnapshotV0 } from "./migrations.types";
import { NAVIGATION_SNAPSHOT_SCHEMA_VERSION, type NavigationSnapshot, type SerializableFoundNode } from "./types";

export function runMigrations(
    branchName: string,
    data: NavigationSnapshotV0 | NavigationSnapshot,
    fromVersion: number
): NavigationSnapshot {
    let migrated: NavigationSnapshotV0 | NavigationSnapshot = data;

    // Run each migration in sequence from the current version to the latest
    for (let version = fromVersion; version < NAVIGATION_SNAPSHOT_SCHEMA_VERSION; version++) {
        migrated = applyMigration(branchName, migrated, version);
    }

    return migrated as NavigationSnapshot;
}

function applyMigration(
    branchName: string,
    data: NavigationSnapshotV0 | NavigationSnapshot,
    fromVersion: number
): NavigationSnapshot {
    switch (fromVersion) {
        case 0:
            // Migration from schema version 0 (StoredNavigationData) to version 1 (NavigationSnapshot)
            return migrateV0ToV1(branchName, data as NavigationSnapshotV0);
        default:
            console.warn(`Unknown schema version ${fromVersion}, skipping migration`);
            return data as NavigationSnapshot;
    }
}

function migrateV0ToV1(branchName: string, oldData: NavigationSnapshotV0): NavigationSnapshot {
    const pageRegistry: NavigationSnapshot["pageRegistry"] = {};
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

            const foundNode: SerializableFoundNode = {
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
                parents: [], // NavigationSnapshotV0 does not contain parents array
                sidebar: clientPageData?.sidebar,
                tabs: [], //NavigationSnapshotV0 does not contain tabs array
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
                parentSectionId: clientPageData?.parentNodeId as FernNavigation.NodeId
            };
        });
    }

    // Migrate docsYmlState.pendingUpdates to docsYmlChanges
    if (oldData.docsYmlState?.pendingUpdates) {
        Object.entries(oldData.docsYmlState.pendingUpdates).forEach(([path, update]) => {
            docsYmlChanges.set(update.pageEntry?.page || path, {
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
