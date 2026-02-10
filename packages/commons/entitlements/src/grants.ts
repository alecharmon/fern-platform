import type { EntitlementGrant } from "./types";

/**
 * SKU -> entitlement grants mapping.
 * Constants for now; will move to Supabase in the future.
 */
export const SKU_GRANTS: Record<string, EntitlementGrant[]> = {
    plan_free: [
        { key: "seats", type: "quantity", limit: 2 },
        { key: "docs_sites", type: "quantity", limit: 1 }
    ],
    plan_pro: [
        { key: "seats", type: "quantity", limit: 10 },
        { key: "docs_sites", type: "quantity", limit: 5 }
    ],
    plan_enterprise: [
        { key: "seats", type: "quantity", limit: 50 },
        { key: "docs_sites", type: "quantity", limit: 25 }
    ],
    addon_extra_seats: [{ key: "seats", type: "quantity", limit: 25 }]
};

/**
 * Collect all grants for a set of active SKUs.
 * Unknown SKUs are silently ignored (future: log warning).
 */
export function getGrantsForSkus(skus: string[]): EntitlementGrant[] {
    return skus.flatMap((sku) => SKU_GRANTS[sku] ?? []);
}
