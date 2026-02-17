import { describe, expect, it, vi } from "vitest";
import { createEntitlementsChecker } from "../check";
import type { EntitlementKey } from "../types";
import type { UsageCache } from "../usage/cache";
import type { UsageProvider } from "../usage/provider";

function mockUsageProvider(counts: Partial<Record<EntitlementKey, number>>): UsageProvider {
    return {
        getCurrentUsage: vi.fn(async (_orgId: string, key: EntitlementKey) => counts[key] ?? 0)
    };
}

function mockUsageCache(cachedCounts: Partial<Record<EntitlementKey, number | null>> = {}): UsageCache {
    const store: Partial<Record<EntitlementKey, number>> = {};
    for (const [k, v] of Object.entries(cachedCounts)) {
        if (v !== null) {
            store[k as EntitlementKey] = v;
        }
    }
    return {
        get: vi.fn(async (_orgId: string, key: EntitlementKey, _staleTtlMs: number) => store[key] ?? null),
        set: vi.fn(async (_orgId: string, key: EntitlementKey, count: number) => {
            store[key] = count;
        }),
        increment: vi.fn(async (_orgId: string, key: EntitlementKey, delta = 1) => {
            store[key] = (store[key] ?? 0) + delta;
            return store[key]!;
        }),
        decrement: vi.fn(async (_orgId: string, key: EntitlementKey, delta = 1) => {
            store[key] = Math.max(0, (store[key] ?? 0) - delta);
            return store[key]!;
        }),
        reset: vi.fn(async () => {
            const count = Object.keys(store).length;
            for (const k of Object.keys(store)) {
                delete store[k as EntitlementKey];
            }
            return count;
        })
    };
}

describe("EntitlementsChecker", () => {
    it("returns entitled with usage details for quantity entitlement", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({ seats: 3 }),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "seats");
        expect(result).toEqual({
            entitled: true,
            type: "quantity",
            limit: 5,
            used: 3,
            remaining: 2
        });
    });

    it("returns not entitled when usage equals limit", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ seats: 2 }),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "seats");
        expect(result).toEqual({
            entitled: false,
            reason: "seats limit reached (2/2)",
            limit: 2,
            used: 2
        });
    });

    it("returns not entitled when at plan_free fallback limit", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => [],
            usageProvider: mockUsageProvider({ seats: 2 }),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "seats");
        expect(result).toEqual({
            entitled: false,
            reason: "seats limit reached (2/2)",
            limit: 2,
            used: 2
        });
    });

    it("uses cached usage when fresh", async () => {
        const provider = mockUsageProvider({ seats: 99 });
        const cache = mockUsageCache({ seats: 3 });

        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: provider,
            usageCache: cache
        });

        const result = await checker.check("org-1", "seats");
        expect(result.entitled).toBe(true);
        if (result.entitled && result.type === "quantity") {
            expect(result.used).toBe(3); // from cache, not provider
        }
        expect(provider.getCurrentUsage).not.toHaveBeenCalled();
    });

    it("returns entitled for boolean entitlement (Pro plan, subpath)", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "custom_domain_subpath");
        expect(result).toEqual({
            entitled: true,
            type: "boolean"
        });
    });

    it("returns not entitled for boolean entitlement (free plan, subpath)", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "custom_domain_subpath");
        expect(result).toEqual({
            entitled: false,
            reason: "No active entitlement for custom_domain_subpath"
        });
    });

    it("returns not entitled for boolean entitlement (no SKUs / free fallback, subpath)", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => [],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "custom_domain_subpath");
        expect(result).toEqual({
            entitled: false,
            reason: "No active entitlement for custom_domain_subpath"
        });
    });

    it("falls back to provider when cache misses and writes through", async () => {
        const provider = mockUsageProvider({ seats: 3 });
        const cache = mockUsageCache(); // empty cache

        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: provider,
            usageCache: cache
        });

        await checker.check("org-1", "seats");
        expect(provider.getCurrentUsage).toHaveBeenCalledWith("org-1", "seats");
        expect(cache.set).toHaveBeenCalledWith("org-1", "seats", 3);
    });
});

describe("boolean entitlements", () => {
    it("returns entitled for boolean grant with enabled: true", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "can_purchase_additional_seats");
        expect(result).toEqual({ entitled: true, type: "boolean" });
    });

    it("returns denied for boolean grant with enabled: false", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "can_purchase_additional_seats");
        expect(result.entitled).toBe(false);
    });
});

describe("denied result includes limit and used", () => {
    it("should include limit and used when quantity entitlement is denied", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ seats: 5 }),
            usageCache: mockUsageCache()
        });

        const result = await checker.check("org-1", "seats");
        expect(result.entitled).toBe(false);
        expect(result).toHaveProperty("limit", 2);
        expect(result).toHaveProperty("used", 5);
    });
});

describe("EntitlementChecker (.for())", () => {
    it("canCreate returns true when under limit", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ docs_sites: 0 }),
            usageCache: mockUsageCache()
        });

        const docSites = checker.for("org-1", "docs_sites");
        expect(await docSites.canCreate()).toBe(true);
    });

    it("canCreate returns false when at limit", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ docs_sites: 1 }),
            usageCache: mockUsageCache()
        });

        const docSites = checker.for("org-1", "docs_sites");
        expect(await docSites.canCreate()).toBe(false);
    });

    it("canCreate(n) checks if N more can be created", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({ seats: 4 }),
            usageCache: mockUsageCache()
        });

        const seats = checker.for("org-1", "seats");
        expect(await seats.canCreate(1)).toBe(true); // 4 + 1 <= 5
        expect(await seats.canCreate(2)).toBe(false); // 4 + 2 > 5
    });

    it("remaining returns correct count", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({ seats: 2 }),
            usageCache: mockUsageCache()
        });

        const seats = checker.for("org-1", "seats");
        expect(await seats.remaining()).toBe(3); // 5 - 2
    });

    it("recordCreate increments cache", async () => {
        const cache = mockUsageCache();
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ docs_sites: 0 }),
            usageCache: cache
        });

        const docSites = checker.for("org-1", "docs_sites");
        await docSites.recordCreate();
        expect(cache.increment).toHaveBeenCalledWith("org-1", "docs_sites", 1);
    });

    it("recordDelete decrements cache", async () => {
        const cache = mockUsageCache();
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ docs_sites: 0 }),
            usageCache: cache
        });

        const docSites = checker.for("org-1", "docs_sites");
        await docSites.recordDelete();
        expect(cache.decrement).toHaveBeenCalledWith("org-1", "docs_sites", 1);
    });

    it("used returns current usage", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({ seats: 4 }),
            usageCache: mockUsageCache()
        });

        const seats = checker.for("org-1", "seats");
        expect(await seats.used()).toBe(4);
    });

    it("isEntitled returns true for boolean entitlement on Pro plan", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const subpath = checker.for("org-1", "custom_domain_subpath");
        expect(await subpath.isEntitled()).toBe(true);
    });

    it("isEntitled returns false for boolean entitlement on free plan", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const subpath = checker.for("org-1", "custom_domain_subpath");
        expect(await subpath.isEntitled()).toBe(false);
    });

    it("limit returns resolved limit", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["2025-02-05:docs-team", "2025-02-10:additional-seats"],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        const seats = checker.for("org-1", "seats");
        expect(await seats.limit()).toBe(6); // 5 + 1
    });
});
