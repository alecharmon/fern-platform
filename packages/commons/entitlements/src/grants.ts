import {
    ADDITIONAL_CUSTOM_DOMAINS_SKU,
    ADDITIONAL_SEATS_SKU,
    LEGACY_PLAN_SKU,
    PRO_PLAN_CURRENT_SKU
} from "@fern-platform/billing";
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
        { key: "can_purchase_additional_custom_domains", type: "boolean", enabled: true },
        { key: "seats", type: "quantity", limit: 5 },
        { key: "number_of_custom_domains", type: "quantity", limit: 1 },
        { key: "pdf_export", type: "boolean", enabled: true },
        { key: "ai_credits", type: "metered", allowance: 1000 },
        { key: "password_protection", type: "boolean", enabled: true }
    ],
    [LEGACY_PLAN_SKU]: [
        { key: "can_purchase_additional_seats", type: "boolean", enabled: false },
        { key: "can_purchase_additional_custom_domains", type: "boolean", enabled: false },
        { key: "seats", type: "quantity", limit: Infinity },
        { key: "docs_sites", type: "quantity", limit: Infinity },
        { key: "custom_domain_subpath", type: "boolean", enabled: true },
        { key: "number_of_custom_domains", type: "quantity", limit: Infinity },
        { key: "pdf_export", type: "boolean", enabled: true },
        { key: "ai_credits", type: "metered", allowance: 1000 },
        { key: "password_protection", type: "boolean", enabled: true }
    ],
    [ADDITIONAL_SEATS_SKU]: [{ key: "seats", type: "quantity", limit: 1 }],
    // Each unit adds +1 to the org's custom domain allowance. Grants additional_custom_domains
    // (not number_of_custom_domains directly) so the base plan's "max" merge is preserved.
    // The resolve step folds this into number_of_custom_domains for a single combined limit.
    [ADDITIONAL_CUSTOM_DOMAINS_SKU]: [{ key: "additional_custom_domains", type: "quantity", limit: 1 }]
} as const;

/** SKUs that represent a base plan (not an addon). */
const PLAN_SKUS = new Set<string>([PRO_PLAN_CURRENT_SKU, LEGACY_PLAN_SKU]);

export const FREE_PLAN_GRANTS: EntitlementGrant[] = [
    { key: "can_purchase_additional_seats", type: "boolean", enabled: false },
    { key: "can_purchase_additional_custom_domains", type: "boolean", enabled: false },
    { key: "seats", type: "quantity", limit: 2 },
    { key: "docs_sites", type: "quantity", limit: 5 },
    { key: "number_of_custom_domains", type: "quantity", limit: 1 },
    { key: "ai_credits", type: "metered", allowance: 250 }
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

    // If no plan SKU is present (only addons or unknown SKUs), include the free
    // plan as a baseline so addon-only overrides don't strip base entitlements.
    const hasPlanSku = skus.some((sku) => PLAN_SKUS.has(sku));
    if (!hasPlanSku) {
        grants.unshift(...FREE_PLAN_GRANTS);
    }

    return grants;
}
