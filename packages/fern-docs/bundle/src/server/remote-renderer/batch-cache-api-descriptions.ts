import "server-only";

import { createHash } from "node:crypto";
import type * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";
import { unstable_cache } from "next/cache";
import type { TypeDefinitionWithSerializedDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";
import { serializeAllTypeDefinitionDescriptions } from "@/mdx/plugins/serialize-type-definition-descriptions";

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_REMOTE_RENDERER === "true";

/**
 * Creates a stable cache key by hashing API type definitions.
 * Uses type IDs + description content as the basis for the hash.
 */
function hashApiTypes(types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>): string {
    // Create a stable string representation of the types
    // We only need to include content that affects serialization output
    const stableContent = Object.entries(types)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort by type ID for stability
        .map(([id, type]) => {
            // Extract just the descriptions that will be serialized
            const descriptions: string[] = [];

            if (type.description) {
                descriptions.push(type.description);
            }

            // Extract descriptions from shape
            if (type.shape.type === "object") {
                type.shape.properties.forEach((prop) => {
                    if (prop.description) {
                        descriptions.push(prop.description);
                    }
                });
            } else if (type.shape.type === "enum") {
                type.shape.values.forEach((val) => {
                    if (val.description) {
                        descriptions.push(val.description);
                    }
                });
            } else if (type.shape.type === "discriminatedUnion") {
                type.shape.variants.forEach((variant) => {
                    if (variant.description) {
                        descriptions.push(variant.description);
                    }
                    variant.properties.forEach((prop) => {
                        if (prop.description) {
                            descriptions.push(prop.description);
                        }
                    });
                });
            } else if (type.shape.type === "undiscriminatedUnion") {
                type.shape.variants.forEach((variant) => {
                    if (variant.description) {
                        descriptions.push(variant.description);
                    }
                });
            }

            return `${id}:${descriptions.join("|")}`;
        })
        .join("||");

    // Hash the content for a compact cache key
    return createHash("sha256").update(stableContent).digest("hex").slice(0, 16);
}

/**
 * Serializes all API type descriptions with simple chunked caching.
 *
 * **Strategy:**
 * - Split types into chunks of ~30 types each (before serialization)
 * - Cache each chunk independently
 * - Each chunk serializes only its types (output well under 2MB)
 * - On cache hit: instant. On cache miss: serialize just that chunk.
 *
 * **Benefits:**
 * - Simple and clean - no metadata, no cold-start logic
 * - Each chunk is independent and self-healing
 * - ~10-20 cache lookups instead of 300+
 * - All cache entries guaranteed under 2MB
 *
 * **Usage:**
 * ```ts
 * const serializedTypes = useRemoteRendering
 *   ? await serializeApiDescriptionsWithBatchCache(types, node.slug)
 *   : types;
 * ```
 */
export async function serializeApiDescriptionsWithBatchCache(
    types: Record<ApiDefinition.TypeId, ApiDefinition.TypeDefinition>,
    cacheTag?: string
): Promise<Record<ApiDefinition.TypeId, TypeDefinitionWithSerializedDescriptions>> {
    const cacheKey = hashApiTypes(types);
    const tags = cacheTag ? [cacheTag, "api-descriptions"] : ["api-descriptions"];
    const entries = Object.entries(types);

    if (DEBUG) {
        console.log(`[BatchCache:API] 🔑 Cache key: ${cacheKey}, types: ${entries.length}`);
    }

    // Split types into groups of ~30 (each group's serialized output stays well under 2MB)
    const CHUNK_SIZE = 30;
    const typeChunks: Array<[string, ApiDefinition.TypeDefinition][]> = [];
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        typeChunks.push(entries.slice(i, i + CHUNK_SIZE));
    }

    if (DEBUG) {
        console.log(`[BatchCache:API] 📦 Fetching ${typeChunks.length} chunks (${CHUNK_SIZE} types each)...`);
    }

    const start = Date.now();

    // Each chunk has its own cache entry. On hit: instant. On miss: serialize just that chunk.
    // Use Promise.allSettled so that a single chunk failure doesn't crash the entire page.
    const chunkSettled = await Promise.allSettled(
        typeChunks.map((chunkEntries, index) => {
            const chunkTypes = Object.fromEntries(chunkEntries);
            return unstable_cache(
                () => serializeAllTypeDefinitionDescriptions(chunkTypes),
                [`api-desc:${cacheKey}:chunk${index}`],
                { tags, revalidate: 900 }
            )();
        })
    );

    const duration = Date.now() - start;

    // Collect successful results and fall back to raw types for failed chunks
    const chunkResults: Record<string, TypeDefinitionWithSerializedDescriptions>[] = [];
    for (const [i, result] of chunkSettled.entries()) {
        if (result.status === "fulfilled") {
            chunkResults.push(result.value);
        } else {
            console.error(`[BatchCache:API] Chunk ${i} failed, falling back to raw types:`, result.reason);
            // Fall back to raw types (unserialized) for this chunk so the page still renders
            const chunk = typeChunks[i];
            if (chunk != null) {
                chunkResults.push(
                    Object.fromEntries(chunk) as Record<string, TypeDefinitionWithSerializedDescriptions>
                );
            }
        }
    }

    if (DEBUG) {
        const successCount = chunkSettled.filter((r) => r.status === "fulfilled").length;
        console.log(
            `[BatchCache:API] Retrieved ${successCount}/${typeChunks.length} chunks successfully in ${duration}ms`
        );
    }

    // Merge all chunks
    return Object.assign({}, ...chunkResults);
}
