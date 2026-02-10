import { describe, expect, it, vi } from "vitest";
import { createEntitlementsChecker } from "../check";
import { EntitlementDeniedError, withEntitlement } from "../middleware";
import type { EntitlementKey } from "../types";
import type { UsageCache } from "../usage/cache";
import type { UsageProvider } from "../usage/provider";

function mockUsageProvider(counts: Partial<Record<EntitlementKey, number>>): UsageProvider {
    return { getCurrentUsage: vi.fn(async (_orgId: string, key: EntitlementKey) => counts[key] ?? 0) };
}

function mockUsageCache(): UsageCache {
    return {
        get: vi.fn(async () => null),
        set: vi.fn(async () => {}),
        increment: vi.fn(async (_o: string, _k: EntitlementKey, d = 1) => d),
        decrement: vi.fn(async (_o: string, _k: EntitlementKey, d = 1) => d)
    };
}

describe("withEntitlement", () => {
    it("executes fn when entitled", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_pro"],
            usageProvider: mockUsageProvider({ docs_sites: 2 }),
            usageCache: mockUsageCache()
        });

        const result = await withEntitlement(checker, "org-1", "docs_sites", async () => {
            return "created";
        });

        expect(result).toBe("created");
    });

    it("throws EntitlementDeniedError when not entitled", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ docs_sites: 1 }),
            usageCache: mockUsageCache()
        });

        await expect(withEntitlement(checker, "org-1", "docs_sites", async () => "created")).rejects.toThrow(
            EntitlementDeniedError
        );
    });

    it("throws with correct reason message", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => ["plan_free"],
            usageProvider: mockUsageProvider({ docs_sites: 1 }),
            usageCache: mockUsageCache()
        });

        await expect(withEntitlement(checker, "org-1", "docs_sites", async () => "created")).rejects.toThrow(
            "docs_sites limit reached (1/1)"
        );
    });

    it("throws when no entitlement exists", async () => {
        const checker = createEntitlementsChecker({
            getActiveSkus: async () => [],
            usageProvider: mockUsageProvider({}),
            usageCache: mockUsageCache()
        });

        await expect(withEntitlement(checker, "org-1", "seats", async () => "created")).rejects.toThrow(
            "No active entitlement for seats"
        );
    });

    it("EntitlementDeniedError has statusCode 403", async () => {
        const error = new EntitlementDeniedError("test");
        expect(error.statusCode).toBe(403);
        expect(error.name).toBe("EntitlementDeniedError");
    });
});
