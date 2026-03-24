import { createHash } from "crypto";

/**
 * Compute a SHA-256 hash over all searchable/filterable record attributes.
 *
 * The incremental reindexer uses this hash to decide whether a record needs
 * re-vectorization and upsert.  By hashing **all** meaningful attributes
 * (not just the document body), we ensure that changes to auth config,
 * page titles, breadcrumbs, URLs, roles, etc. are detected and trigger a
 * re-upsert even when the raw document content hasn't changed.
 *
 * Excluded from the hash (metadata that doesn't affect search quality):
 *   - `chunk_index`        — positional, varies per chunk of the same parent
 *   - `parent_id`          — grouping key used by the diff algorithm
 *   - `parent_content_hash`— the hash itself
 *   - `keywords`           — derived from the chunk (already covered by `document`)
 *   - `description`        — currently always `undefined` for pages
 */
export function hashRecordAttributes(attrs: Record<string, unknown>): string {
    // JSON.stringify with sorted keys for deterministic output
    const serialized = JSON.stringify(attrs, Object.keys(attrs).sort());
    return createHash("sha256").update(serialized).digest("hex");
}
