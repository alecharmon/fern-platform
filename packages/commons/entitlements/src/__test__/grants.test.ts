import { describe, expect, it } from "vitest";
import { getGrantsForSkus, SKU_GRANTS } from "../grants";
import type { EntitlementGrant } from "../types";

describe("SKU grants", () => {
    it("getGrantsForSkus collects grants from multiple SKUs", () => {
        const grants = getGrantsForSkus(["plan_free"]);
        expect(grants).toHaveLength(4);
    });

    it("getGrantsForSkus falls back to plan_free for unknown SKU", () => {
        const grants = getGrantsForSkus(["unknown_sku"]);
        expect(grants).toHaveLength(4);
        expect(grants.find((g: EntitlementGrant) => g.key === "seats")).toEqual({
            key: "seats",
            type: "quantity",
            limit: 2
        });
    });

    it("getGrantsForSkus combines grants from plan + addon", () => {
        const grants = getGrantsForSkus(["2025-02-05:docs-team", "2025-02-10:additional-seats"]);
        const seatGrants = grants.filter((g: EntitlementGrant) => g.key === "seats");
        expect(seatGrants).toHaveLength(2);
    });

    it("docs-team grants custom_domain_subpath", () => {
        const grants = SKU_GRANTS["2025-02-05:docs-team"];
        expect(grants!.find((g: EntitlementGrant) => g.key === "custom_domain_subpath")).toEqual({
            key: "custom_domain_subpath",
            type: "boolean",
            enabled: true
        });
    });

    it("legacy:custom-enterprise grants custom_domain_subpath", () => {
        const grants = SKU_GRANTS["legacy:custom-enterprise"];
        expect(grants!.find((g: EntitlementGrant) => g.key === "custom_domain_subpath")).toEqual({
            key: "custom_domain_subpath",
            type: "boolean",
            enabled: true
        });
    });

    it("2025-02-05:docs-team enables can_purchase_additional_seats", () => {
        const grants = SKU_GRANTS["2025-02-05:docs-team"];
        expect(grants).toBeDefined();
        expect(grants!.find((g: EntitlementGrant) => g.key === "can_purchase_additional_seats")).toEqual({
            key: "can_purchase_additional_seats",
            type: "boolean",
            enabled: true
        });
    });
});
