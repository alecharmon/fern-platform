/**
 * Content diff service for incremental reindexing.
 *
 * Compares current content from FDR against indexed content hashes to determine
 * what needs to be added, updated, or deleted from Turbopuffer.
 *
 * This service uses FAI's content hash API routes to store/retrieve content hashes.
 */

import type { FernAIClient } from "@fern-api/fai-sdk";
import { createHash } from "crypto";

export interface DiffItem {
    parent_id: string;
    content: string;
    content_hash: string;
    chunk_count: number;
}

export interface ContentDiff {
    /** Content hasn't changed, no action needed */
    unchanged: string[];
    /** Content has changed, need to re-chunk and re-vectorize */
    updated: DiffItem[];
    /** New content, need to chunk and vectorize */
    added: DiffItem[];
    /** Content no longer exists, need to delete from Turbopuffer */
    deleted: string[];
}

/**
 * Compute SHA-256 hash of content.
 */
export function computeContentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
}

export interface IndexedContentHash {
    content_hash: string;
    chunk_count: number;
}

/**
 * Get all content hashes for a domain from FAI.
 * Uses pagination to handle large docs sites with 10k+ pages.
 */
export async function getContentHashesForDomain(
    domain: string,
    faiClient: FernAIClient
): Promise<Map<string, IndexedContentHash>> {
    const hashMap = new Map<string, IndexedContentHash>();
    let offset = 0;
    const limit = 1000;

    while (true) {
        const response = await faiClient.contentHash.batchGetContentHashes(domain, {
            parent_ids: [],
            limit,
            offset
        });

        for (const entry of response.entries) {
            hashMap.set(entry.parent_id, {
                content_hash: entry.content_hash,
                chunk_count: entry.chunk_count
            });
        }

        if (!response.has_more) {
            break;
        }

        offset += limit;
    }

    return hashMap;
}

export interface ContentDiffWithMetadata {
    diff: ContentDiff;
    oldHashMetadata: Map<string, IndexedContentHash>;
}

/**
 * Compare current content against indexed content hashes.
 *
 * @param domain - The domain being indexed
 * @param currentContent - Map of parentId -> {content, chunk_count}
 * @param faiClient - FAI client to fetch existing hashes
 * @returns ContentDiff with categorized changes and indexed hashes for reference
 */
export async function getContentDiff(
    domain: string,
    currentContent: Map<string, { content: string; chunk_count: number }>,
    faiClient: FernAIClient
): Promise<ContentDiffWithMetadata> {
    const indexedHashes = await getContentHashesForDomain(domain, faiClient);

    const seenParentIds = new Set<string>();

    const diff: ContentDiff = {
        unchanged: [],
        updated: [],
        added: [],
        deleted: []
    };

    for (const [parentId, { content, chunk_count }] of currentContent) {
        const contentHash = computeContentHash(content);
        seenParentIds.add(parentId);

        const indexed = indexedHashes.get(parentId);

        if (indexed === undefined) {
            diff.added.push({ parent_id: parentId, content, content_hash: contentHash, chunk_count });
        } else if (indexed.content_hash !== contentHash) {
            diff.updated.push({ parent_id: parentId, content, content_hash: contentHash, chunk_count });
        } else {
            diff.unchanged.push(parentId);
        }
    }

    for (const parentId of indexedHashes.keys()) {
        if (!seenParentIds.has(parentId)) {
            diff.deleted.push(parentId);
        }
    }

    return { diff, oldHashMetadata: indexedHashes };
}

/**
 * Upsert content hashes to FAI after reindexing.
 * Batches requests in groups of 1000 to avoid overwhelming the API.
 *
 * @param domain - The domain being indexed
 * @param items - List of DiffItems (from added or updated lists)
 * @param faiClient - FAI client to upsert hashes
 */
export async function upsertContentHashes(domain: string, items: DiffItem[], faiClient: FernAIClient): Promise<void> {
    if (items.length === 0) {
        return;
    }

    const BATCH_SIZE = 1000;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);

        await faiClient.contentHash.batchUpsertContentHashes(domain, {
            entries: batch.map((item) => ({
                parent_id: item.parent_id,
                content_hash: item.content_hash,
                chunk_count: item.chunk_count
            }))
        });
    }
}

/**
 * Delete content hashes from FAI for removed pages/endpoints.
 *
 * @param domain - The domain being indexed
 * @param parentIds - List of parent_ids to delete
 * @param faiClient - FAI client to delete hashes
 */
export async function deleteContentHashes(
    domain: string,
    parent_ids: string[],
    faiClient: FernAIClient
): Promise<void> {
    if (parent_ids.length === 0) {
        return;
    }

    await faiClient.contentHash.deleteContentHashes(domain, {
        parent_ids
    });
}
