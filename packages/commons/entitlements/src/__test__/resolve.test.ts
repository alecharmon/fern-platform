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

    it("merges seats with sum strategy (plan_pro + addon_extra_seats)", () => {
        const resolved = resolveEntitlements(["plan_pro", "addon_extra_seats"]);
        expect(resolved.seats).toEqual({ type: "quantity", limit: 35 }); // 10 + 25
    });

    it("merges docs_sites with max strategy (plan_pro only, no addon)", () => {
        const resolved = resolveEntitlements(["plan_pro"]);
        expect(resolved.docs_sites).toEqual({ type: "quantity", limit: 5 });
    });

    it("returns empty for unknown SKUs", () => {
        const resolved = resolveEntitlements(["unknown"]);
        expect(resolved).toEqual({});
    });

    it("handles empty SKU list", () => {
        const resolved = resolveEntitlements([]);
        expect(resolved).toEqual({});
    });

    it("max strategy takes highest across multiple SKUs", () => {
        // plan_free has 1 docs_site, plan_pro has 5
        const resolved = resolveEntitlements(["plan_free", "plan_pro"]);
        expect(resolved.docs_sites).toEqual({ type: "quantity", limit: 5 });
    });
});
