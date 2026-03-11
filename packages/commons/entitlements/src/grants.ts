import { ADDITIONAL_SEATS_SKU, LEGACY_PLAN_SKU, PRO_PLAN_CURRENT_SKU } from "@fern-platform/billing";
import type { EntitlementGrant } from "./types";

/**
 * SKU -> entitlement grants mapping.
 * Constants for now; will move to Supabase in the future.
 */
export const SKU_GRANTS: Record<string, EntitlementGrant[]> = {
    [PRO_PLAN_CURRENT_SKU]: [
        { key: "docs_sites", type: "quantity", limit: 5 },
        { key: "custom_domain_subpath", type: "boolean", enabled: true },
        { key: "can_purchase_additional_seats", type: "boolean", enabled: true },
        { key: "seats", type: "quantity", limit: 5 },
        { key: "number_of_custom_domains", type: "quantity", limit: 1 },
        { key: "pdf_export", type: "boolean", enabled: true }
    ],
    [LEGACY_PLAN_SKU]: [
        // They have infinite seats so they dont need to be able to purchase additional
        // seat
        { key: "can_purchase_additional_seats", type: "boolean", enabled: false },
        { key: "seats", type: "quantity", limit: Infinity },
        { key: "docs_sites", type: "quantity", limit: Infinity },
        { key: "custom_domain_subpath", type: "boolean", enabled: true },
        { key: "number_of_custom_domains", type: "quantity", limit: Infinity },
        { key: "pdf_export", type: "boolean", enabled: true }
    ],
    [ADDITIONAL_SEATS_SKU]: [{ key: "seats", type: "quantity", limit: 1 }]
} as const;

export const FREE_PLAN_GRANTS: EntitlementGrant[] = [
    { key: "can_purchase_additional_seats", type: "boolean", enabled: false },
    { key: "seats", type: "quantity", limit: 2 },
    { key: "docs_sites", type: "quantity", limit: 5 },
    { key: "number_of_custom_domains", type: "quantity", limit: 1 }
];

/**
 * Collect all grants for a set of active SKUs.
 * Unknown SKUs are logged as warnings.
 */
export function getGrantsForSkus(skus: string[]): EntitlementGrant[] {
    for (const sku of skus) {
        if (!(sku in SKU_GRANTS)) {
            // biome-ignore lint/suspicious/noConsole: entitlements logging
            console.warn(`[entitlements] unknown SKU ignored: ${sku}`);
        }
    }
    const grants = skus.flatMap((sku) => SKU_GRANTS[sku] ?? []);

    // If they dont have any grants just assume free
    if (grants.length === 0) {
        grants.push(...FREE_PLAN_GRANTS);
    }

    return grants;
}
