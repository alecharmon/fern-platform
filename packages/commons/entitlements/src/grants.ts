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
    "2025-02-05:docs-team": [
        { key: "seats", type: "quantity", limit: 5 },
        { key: "docs_sites", type: "quantity", limit: 1 },
        { key: "custom_domain_subpath", type: "boolean", enabled: true }
    ],
    "legacy:custom-enterprise": [
        { key: "seats", type: "quantity", limit: Infinity },
        { key: "docs_sites", type: "quantity", limit: Infinity },
        { key: "custom_domain_subpath", type: "boolean", enabled: true }
    ],
    addon_extra_seats: [{ key: "seats", type: "quantity", limit: 1 }]
};

/**
 * Collect all grants for a set of active SKUs.
 * Unknown SKUs are silently ignored (future: log warning).
 */
export function getGrantsForSkus(skus: string[]): EntitlementGrant[] {
    const grants = skus.flatMap((sku) => SKU_GRANTS[sku] ?? []);

    // If they dont have any grants just assume free
    if (grants.length === 0) {
        grants.push(...SKU_GRANTS.plan_free!);
    }

    return grants;
}
