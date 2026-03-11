import { describe, expect, it } from "vitest";
import { resolveEntitlements } from "../resolve";

describe("resolveEntitlements", () => {
    it("resolves single plan SKU", () => {
        const resolved = resolveEntitlements(["plan_free"]);
        expect(resolved).toEqual({
            can_purchase_additional_seats: {
                enabled: false,
                type: "boolean"
            },
            seats: { type: "quantity", limit: 2 },
            docs_sites: { type: "quantity", limit: 5 },
            number_of_custom_domains: { type: "quantity", limit: 1 },
            ai_credits: { type: "metered", allowance: 250 }
        });
    });

    it("merges seats with sum strategy (docs-team + additional-seats)", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team", "2025-02-10:additional-seats"]);
        expect(resolved.seats).toEqual({ type: "quantity", limit: 6 }); // 5 + 1
    });

    it("docs-team includes docs_sites", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team"]);
        expect(resolved.docs_sites).toEqual({ type: "quantity", limit: 5 });
    });

    it("docs-team enables can_purchase_additional_seats", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team"]);
        expect(resolved.can_purchase_additional_seats).toEqual({ type: "boolean", enabled: true });
    });

    it("falls back to plan_free for unknown SKUs", () => {
        const resolved = resolveEntitlements(["unknown"]);
        expect(resolved).toEqual({
            can_purchase_additional_seats: {
                enabled: false,
                type: "boolean"
            },
            seats: { type: "quantity", limit: 2 },
            docs_sites: { type: "quantity", limit: 5 },
            number_of_custom_domains: { type: "quantity", limit: 1 },
            ai_credits: { type: "metered", allowance: 250 }
        });
    });

    it("falls back to plan_free for empty SKU list", () => {
        const resolved = resolveEntitlements([]);
        expect(resolved).toEqual({
            can_purchase_additional_seats: {
                enabled: false,
                type: "boolean"
            },
            seats: { type: "quantity", limit: 2 },
            docs_sites: { type: "quantity", limit: 5 },
            number_of_custom_domains: { type: "quantity", limit: 1 },
            ai_credits: { type: "metered", allowance: 250 }
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

    it("boolean OR: enabled overrides disabled across SKUs", () => {
        // plan_free has enabled: false, docs-team has enabled: true
        const resolved = resolveEntitlements(["plan_free", "2025-02-05:docs-team"]);
        expect(resolved.can_purchase_additional_seats).toEqual({ type: "boolean", enabled: true });
    });

    it("docs-team grants 1 custom domain", () => {
        const resolved = resolveEntitlements(["2025-02-05:docs-team"]);
        expect(resolved.number_of_custom_domains).toEqual({ type: "quantity", limit: 1 });
    });

    it("legacy:custom-enterprise grants infinite custom domains", () => {
        const resolved = resolveEntitlements(["legacy:custom-enterprise"]);
        expect(resolved.number_of_custom_domains).toEqual({ type: "quantity", limit: Infinity });
    });

    it("plan_free grants 1 custom domain", () => {
        const resolved = resolveEntitlements(["plan_free"]);
        expect(resolved.number_of_custom_domains).toEqual({ type: "quantity", limit: 1 });
    });
});
