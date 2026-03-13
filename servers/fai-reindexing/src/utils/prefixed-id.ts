import { createHash } from "crypto";

const MAX_ID_LENGTH = 64;

/**
 * Create a prefixed ID for use in the query namespace.
 * Mirrors the Python `prefixed_id` function in fai/utils/turbopuffer/sync.py.
 *
 * Format: "{namespace}:{originalId}" if within max length,
 * otherwise truncates the namespace and hashes the original ID.
 */
export function prefixedId(namespace: string, originalId: string): string {
    const newId = `${namespace}:${originalId}`;
    if (Buffer.byteLength(newId, "utf-8") <= MAX_ID_LENGTH) {
        return newId;
    }
    const hashed = createHash("sha256").update(originalId).digest("hex").slice(0, 16);
    const shortNs = namespace.slice(0, MAX_ID_LENGTH - hashed.length - 1);
    return `${shortNs}:${hashed}`;
}
