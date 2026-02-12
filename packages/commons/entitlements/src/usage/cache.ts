import { getClient } from "@fern-platform/supabase";
import type { EntitlementKey } from "../types";

/**
 * Write-through cache for entitlement usage counts.
 * Backed by the `org_entitlement_usage` Supabase table.
 *
 * Known limitations:
 * - increment/decrement use a non-atomic read-modify-write. Under high concurrency
 *   the cache may drift, but the usage provider reconciles on the next stale check.
 *   TODO: Use a Supabase RPC with `SET usage_count = usage_count + $delta` for atomicity.
 * - Write failures (set/increment/decrement) are silently swallowed since this is a
 *   cache layer. The usage provider remains the source of truth.
 */
export interface UsageCache {
    /** Get cached count. Returns null if stale or missing. */
    get(orgId: string, key: EntitlementKey, staleTtlMs: number): Promise<number | null>;

    /** Write a fresh count (from the usage provider). */
    set(orgId: string, key: EntitlementKey, count: number): Promise<void>;

    /** Increment count by delta (default 1). Returns new count. */
    increment(orgId: string, key: EntitlementKey, delta?: number): Promise<number>;

    /** Decrement count by delta (default 1). Returns new count. */
    decrement(orgId: string, key: EntitlementKey, delta?: number): Promise<number>;

    /** Delete all cached usage entries for an org. Returns the number of entries cleared. */
    reset(orgId: string): Promise<number>;
}

const TABLE = "org_entitlement_usage" as const;

export function createUsageCache(): UsageCache {
    return {
        async get(orgId, key, staleTtlMs) {
            const client = getClient();
            const { data, error } = await client
                .from(TABLE)
                .select("usage_count, updated_at")
                .eq("org_id", orgId)
                .eq("key", key)
                .maybeSingle();

            if (error || !data) {
                return null;
            }

            const age = Date.now() - new Date(data.updated_at).getTime();
            if (age > staleTtlMs) {
                return null;
            }

            return data.usage_count;
        },

        async set(orgId, key, count) {
            const client = getClient();
            await client
                .from(TABLE)
                .upsert(
                    { org_id: orgId, key, usage_count: count, updated_at: new Date().toISOString() },
                    { onConflict: "org_id,key" }
                );
        },

        async increment(orgId, key, delta = 1) {
            const client = getClient();
            const { data } = await client
                .from(TABLE)
                .select("usage_count")
                .eq("org_id", orgId)
                .eq("key", key)
                .maybeSingle();

            const current = data?.usage_count ?? 0;
            const next = current + delta;

            await client
                .from(TABLE)
                .upsert(
                    { org_id: orgId, key, usage_count: next, updated_at: new Date().toISOString() },
                    { onConflict: "org_id,key" }
                );

            return next;
        },

        async decrement(orgId, key, delta = 1) {
            const client = getClient();
            const { data } = await client
                .from(TABLE)
                .select("usage_count")
                .eq("org_id", orgId)
                .eq("key", key)
                .maybeSingle();

            const current = data?.usage_count ?? 0;
            const next = Math.max(0, current - delta);

            await client
                .from(TABLE)
                .upsert(
                    { org_id: orgId, key, usage_count: next, updated_at: new Date().toISOString() },
                    { onConflict: "org_id,key" }
                );

            return next;
        },

        async reset(orgId) {
            const client = getClient();
            const { data, error } = await client.from(TABLE).delete().eq("org_id", orgId).select("key");

            if (error) {
                return 0;
            }

            return data?.length ?? 0;
        }
    };
}
