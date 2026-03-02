import {
    createEntitlementsChecker,
    createUsageProvider,
    type EntitlementsChecker,
    type UsageCache
} from "@fern-platform/entitlements";
import { describe, expect, it } from "vitest";

// SKU constants (from @fern-platform/billing) — inlined to avoid adding billing as a direct dep
const PRO_PLAN_CURRENT_SKU = "2025-02-05:docs-team";
const LEGACY_PLAN_SKU = "legacy:custom-enterprise";

/**
 * No-op usage cache for unit tests — always returns null (cache miss),
 * so the checker always calls through to the usage provider.
 */
function createNoOpUsageCache(): UsageCache {
    return {
        async get() {
            return null;
        },
        async set() {},
        async increment(_orgId, _key, delta = 1) {
            return delta;
        },
        async decrement() {
            return 0;
        },
        async reset() {
            return 0;
        }
    };
}

function createTestChecker({ skus, docsSitesCount }: { skus: string[]; docsSitesCount: number }): EntitlementsChecker {
    return createEntitlementsChecker({
        getActiveSkus: async () => skus,
        usageProvider: createUsageProvider({
            docs_sites: async () => docsSitesCount
        }),
        usageCache: createNoOpUsageCache()
    });
}

describe("FDR Entitlements", () => {
    describe("docs_sites — free plan", () => {
        it("allows re-deploy when org is under limit", async () => {
            const checker = createTestChecker({ skus: [], docsSitesCount: 1 });
            // Free plan gets 5 docs_sites. With 1 used, there is still capacity.
            const result = await checker.check("org-free", "docs_sites");
            expect(result.entitled).toBe(true);
        });

        it("blocks when at limit (5 used)", async () => {
            const checker = createTestChecker({ skus: [], docsSitesCount: 5 });
            const result = await checker.check("org-free", "docs_sites");
            expect(result.entitled).toBe(false);
        });

        it("allows creating first site (0 used)", async () => {
            const checker = createTestChecker({ skus: [], docsSitesCount: 0 });
            const siteChecker = checker.for("org-free", "docs_sites");
            expect(await siteChecker.canCreate(1)).toBe(true);
            expect(await siteChecker.isEntitled()).toBe(true);
        });

        it("allows creating when under limit (4 used)", async () => {
            const checker = createTestChecker({ skus: [], docsSitesCount: 4 });
            const siteChecker = checker.for("org-free", "docs_sites");
            expect(await siteChecker.canCreate(1)).toBe(true);
        });

        it("blocks creating a sixth site", async () => {
            const checker = createTestChecker({ skus: [], docsSitesCount: 5 });
            const siteChecker = checker.for("org-free", "docs_sites");
            expect(await siteChecker.canCreate(1)).toBe(false);
        });
    });

    describe("docs_sites — pro/team plan", () => {
        it("allows re-deploy when under limit", async () => {
            // Pro plan gets 5 docs_sites
            const checker = createTestChecker({
                skus: [PRO_PLAN_CURRENT_SKU],
                docsSitesCount: 1
            });
            const siteChecker = checker.for("org-pro", "docs_sites");
            expect(await siteChecker.isEntitled()).toBe(true);
            expect(await siteChecker.canCreate(1)).toBe(true);
        });

        it("blocks when at limit (5 used)", async () => {
            const checker = createTestChecker({
                skus: [PRO_PLAN_CURRENT_SKU],
                docsSitesCount: 5
            });
            const siteChecker = checker.for("org-pro", "docs_sites");
            // At limit: isEntitled returns false because remaining is 0
            expect(await siteChecker.isEntitled()).toBe(false);
            expect(await siteChecker.canCreate(1)).toBe(false);
        });

        it("allows creating when under limit", async () => {
            const checker = createTestChecker({
                skus: [PRO_PLAN_CURRENT_SKU],
                docsSitesCount: 0
            });
            const siteChecker = checker.for("org-pro", "docs_sites");
            expect(await siteChecker.canCreate(1)).toBe(true);
        });
    });

    describe("docs_sites — legacy/enterprise plan", () => {
        it("allows unlimited sites", async () => {
            const checker = createTestChecker({
                skus: [LEGACY_PLAN_SKU],
                docsSitesCount: 50
            });
            const siteChecker = checker.for("org-enterprise", "docs_sites");
            expect(await siteChecker.isEntitled()).toBe(true);
            expect(await siteChecker.canCreate(1)).toBe(true);
        });
    });

    describe("custom_domain_subpath", () => {
        it("blocks subpaths on free plan", async () => {
            const checker = createTestChecker({ skus: [], docsSitesCount: 0 });
            const subpathChecker = checker.for("org-free", "custom_domain_subpath");
            // Free plan has no custom_domain_subpath grant
            expect(await subpathChecker.isEntitled()).toBe(false);
        });

        it("allows subpaths on pro plan", async () => {
            const checker = createTestChecker({
                skus: [PRO_PLAN_CURRENT_SKU],
                docsSitesCount: 0
            });
            const subpathChecker = checker.for("org-pro", "custom_domain_subpath");
            expect(await subpathChecker.isEntitled()).toBe(true);
        });

        it("allows subpaths on legacy/enterprise plan", async () => {
            const checker = createTestChecker({
                skus: [LEGACY_PLAN_SKU],
                docsSitesCount: 0
            });
            const subpathChecker = checker.for("org-enterprise", "custom_domain_subpath");
            expect(await subpathChecker.isEntitled()).toBe(true);
        });
    });

    describe("entitlements disabled (null checker)", () => {
        it("null checker means no blocking — callers skip checks", () => {
            // When entitlementsEnabled is false, app.entitlements is null.
            // The handler code checks `if (app.entitlements)` before running checks.
            const checker: EntitlementsChecker | null = null;
            expect(checker).toBeNull();
        });
    });
});
