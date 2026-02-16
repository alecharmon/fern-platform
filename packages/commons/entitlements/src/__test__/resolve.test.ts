import { describe, expect, it } from "vitest";
import { resolveEntitlements } from "../resolve";

describe("resolveEntitlements", () => {
    it("resolves single plan SKU", () => {
        const resolved = resolveEntitlements(["plan_free"]);
        expect(resolved).toEqual({
            seats: { type: "quantity", limit: 2 },
            docs_sites: { type: "quantity", limit: 1 }
        });
    });

    it("merges seats with sum strategy (docs-team + addon_extra_seats)", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team", "addon_extra_seats"]);
        expect(resolved.seats).toEqual({ type: "quantity", limit: 6 }); // 5 + 1
    });

    it("merges docs_sites with max strategy (docs-team only, no addon)", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team"]);
        expect(resolved.docs_sites).toEqual({ type: "quantity", limit: 1 });
    });

    it("falls back to plan_free for unknown SKUs", () => {
        const resolved = resolveEntitlements(["unknown"]);
        expect(resolved).toEqual({
            seats: { type: "quantity", limit: 2 },
            docs_sites: { type: "quantity", limit: 1 }
        });
    });

    it("falls back to plan_free for empty SKU list", () => {
        const resolved = resolveEntitlements([]);
        expect(resolved).toEqual({
            seats: { type: "quantity", limit: 2 },
            docs_sites: { type: "quantity", limit: 1 }
        });
    });

    it("max strategy takes highest across multiple SKUs", () => {
        // plan_free has 1 docs_site, legacy:custom-enterprise has Infinity
        const resolved = resolveEntitlements(["plan_free", "legacy:custom-enterprise"]);
        expect(resolved.docs_sites).toEqual({ type: "quantity", limit: Infinity });
    });

    it("resolves custom_domain_subpath for docs-team (Pro)", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team"]);
        expect(resolved.custom_domain_subpath).toEqual({ type: "boolean", enabled: true });
    });

    it("resolves custom_domain_subpath for legacy:custom-enterprise", () => {
        const resolved = resolveEntitlements(["legacy:custom-enterprise"]);
        expect(resolved.custom_domain_subpath).toEqual({ type: "boolean", enabled: true });
    });

    it("does not resolve custom_domain_subpath for plan_free", () => {
        const resolved = resolveEntitlements(["plan_free"]);
        expect(resolved.custom_domain_subpath).toBeUndefined();
    });

    it("does not resolve custom_domain_subpath for empty/unknown SKUs (free fallback)", () => {
        const resolved = resolveEntitlements([]);
        expect(resolved.custom_domain_subpath).toBeUndefined();
    });
});
