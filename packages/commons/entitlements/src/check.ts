import { resolveEntitlements } from "./resolve";
import {
    ENTITLEMENT_DEFINITIONS,
    type EntitlementCheckResult,
    type EntitlementDefinition,
    type EntitlementKey,
    isNumericEntitlementKey,
    type NumericEntitlementKey
} from "./types";
import type { UsageCache } from "./usage/cache";
import type { UsageProvider } from "./usage/provider";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface EntitlementsCheckerOptions {
    /** Fetch active SKUs for an org (bridges to billing package). */
    getActiveSkus: (orgId: string) => Promise<string[]>;
    /** Usage count provider — implemented by the consumer. */
    usageProvider: UsageProvider;
    /** Supabase-backed usage cache. */
    usageCache: UsageCache;
    /** How long cached usage counts are considered fresh (default 60s). */
    staleTtlMs?: number;
}

// ---------------------------------------------------------------------------
// EntitlementChecker — high-level, scoped to org + key
// ---------------------------------------------------------------------------

export class EntitlementChecker {
    constructor(
        private readonly checkerInstance: EntitlementsCheckerImpl,
        private readonly cache: UsageCache,
        private readonly orgId: string,
        private readonly key: EntitlementKey
    ) {}

    async isEntitled(): Promise<boolean> {
        const result = await this.checkerInstance.check(this.orgId, this.key);
        return result.entitled;
    }

    async canCreate(n = 1): Promise<boolean> {
        const result = await this.checkerInstance.check(this.orgId, this.key);
        if (!result.entitled) {
            return false;
        }
        if (result.type === "boolean") {
            return true;
        }
        return result.remaining >= n;
    }

    async remaining(): Promise<number> {
        const result = await this.checkerInstance.check(this.orgId, this.key);
        if (!result.entitled) {
            return 0;
        }
        if (result.type === "boolean") {
            return Infinity;
        }
        return result.remaining;
    }

    async used(): Promise<number> {
        const result = await this.checkerInstance.check(this.orgId, this.key);
        if (!result.entitled) {
            return result.used ?? 0;
        }
        if (result.type === "boolean") {
            return 0;
        }
        return result.used;
    }

    async limit(): Promise<number> {
        const result = await this.checkerInstance.check(this.orgId, this.key);
        if (!result.entitled) {
            return result.limit ?? 0;
        }
        if (result.type === "boolean") {
            return Infinity;
        }
        return result.type === "quantity" ? result.limit : result.allowance;
    }

    async recordCreate(n = 1): Promise<void> {
        await this.cache.increment(this.orgId, this.key, n);
    }

    async recordDelete(n = 1): Promise<void> {
        await this.cache.decrement(this.orgId, this.key, n);
    }
}

// ---------------------------------------------------------------------------
// EntitlementsChecker — low-level check + .for() factory
// ---------------------------------------------------------------------------

class EntitlementsCheckerImpl {
    private readonly getActiveSkus: (orgId: string) => Promise<string[]>;
    private readonly usageProvider: UsageProvider;
    private readonly usageCache: UsageCache;
    private readonly staleTtlMs: number;

    constructor(opts: EntitlementsCheckerOptions) {
        this.getActiveSkus = opts.getActiveSkus;
        this.usageProvider = opts.usageProvider;
        this.usageCache = opts.usageCache;
        this.staleTtlMs = opts.staleTtlMs ?? 60_000;
    }

    async check(orgId: string, key: EntitlementKey): Promise<EntitlementCheckResult> {
        const skus = await this.getActiveSkus(orgId);
        const resolved = resolveEntitlements(skus);
        const grant = resolved[key];

        if (!grant) {
            return { entitled: false, reason: `No active entitlement for ${key}` };
        }

        if (grant.type === "boolean") {
            if (!grant.enabled) {
                return { entitled: false, reason: `${key} is not enabled for this plan` };
            }
            return { entitled: true, type: "boolean" };
        }

        // Use type guard to narrow key to NumericEntitlementKey
        if (!isNumericEntitlementKey(key)) {
            return { entitled: false, reason: `Unexpected entitlement type for ${key}` };
        }

        const usage = await this.getUsage(orgId, key);
        // Widen to the full union so TypeScript doesn't narrow out future types
        // (current definitions are all "quantity", but "metered" may be added later).
        const def = ENTITLEMENT_DEFINITIONS[key] as EntitlementDefinition;

        if (grant.type === "quantity") {
            const limit = grant.limit;
            const remaining = Math.max(0, limit - usage);
            if (remaining <= 0) {
                return { entitled: false, reason: `${key} limit reached (${usage}/${limit})`, limit, used: usage };
            }
            return { entitled: true, type: "quantity", limit, used: usage, remaining };
        }

        if (grant.type === "metered" && def.type === "metered") {
            const allowance = grant.allowance;
            const remaining = Math.max(0, allowance - usage);
            if (remaining <= 0 && def.overagePolicy === "hard_cap") {
                return {
                    entitled: false,
                    reason: `${key} allowance exhausted (${usage}/${allowance})`,
                    limit: allowance,
                    used: usage
                };
            }
            return {
                entitled: true,
                type: "metered",
                allowance,
                used: usage,
                remaining,
                overagePolicy: def.overagePolicy
            };
        }

        return { entitled: false, reason: `Unknown entitlement type for ${key}` };
    }

    for(orgId: string, key: EntitlementKey): EntitlementChecker {
        return new EntitlementChecker(this, this.usageCache, orgId, key);
    }

    async resetCache(orgId: string): Promise<number> {
        return this.usageCache.reset(orgId);
    }

    private async getUsage(orgId: string, key: NumericEntitlementKey): Promise<number> {
        const cached = await this.usageCache.get(orgId, key, this.staleTtlMs);
        if (cached !== null) {
            return cached;
        }

        const usage = await this.usageProvider.getCurrentUsage(orgId, key);
        await this.usageCache.set(orgId, key, usage);
        return usage;
    }
}

// ---------------------------------------------------------------------------
// Public interface & factory
// ---------------------------------------------------------------------------

export interface EntitlementsChecker {
    check(orgId: string, key: EntitlementKey): Promise<EntitlementCheckResult>;
    for(orgId: string, key: EntitlementKey): EntitlementChecker;
    /** Clear all cached usage counts for an org. Returns number of entries cleared. */
    resetCache(orgId: string): Promise<number>;
}

export function createEntitlementsChecker(opts: EntitlementsCheckerOptions): EntitlementsChecker {
    return new EntitlementsCheckerImpl(opts);
}
