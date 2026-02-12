import { describe, expect, it } from "vitest";
import { getGrantsForSkus, SKU_GRANTS } from "../grants";
import type { EntitlementGrant } from "../types";

describe("SKU grants", () => {
    it("plan_free grants seats and docs_sites", () => {
        const grants = SKU_GRANTS["plan_free"];
        expect(grants).toBeDefined();
        expect(grants).toHaveLength(2);
        expect(grants!.find((g: EntitlementGrant) => g.key === "seats")).toEqual({
            key: "seats",
            type: "quantity",
            limit: 2
        });
        expect(grants!.find((g: EntitlementGrant) => g.key === "docs_sites")).toEqual({
            key: "docs_sites",
            type: "quantity",
            limit: 1
        });
    });

    it("getGrantsForSkus collects grants from multiple SKUs", () => {
        const grants = getGrantsForSkus(["plan_free"]);
        expect(grants).toHaveLength(2);
    });

    it("getGrantsForSkus falls back to plan_free for unknown SKU", () => {
        const grants = getGrantsForSkus(["unknown_sku"]);
        expect(grants).toHaveLength(2);
        expect(grants.find((g: EntitlementGrant) => g.key === "seats")).toEqual({
            key: "seats",
            type: "quantity",
            limit: 2
        });
    });

    it("getGrantsForSkus combines grants from plan + addon", () => {
        const grants = getGrantsForSkus(["2025-02-05:docs-team", "addon_extra_seats"]);
        const seatGrants = grants.filter((g: EntitlementGrant) => g.key === "seats");
        expect(seatGrants).toHaveLength(2);
    });
});
