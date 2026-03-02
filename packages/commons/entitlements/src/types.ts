// ---------------------------------------------------------------------------
// Entitlement type taxonomy
// ---------------------------------------------------------------------------

export type EntitlementType = "boolean" | "quantity" | "metered";

/** How to merge grants from multiple SKUs for the same entitlement. */
export type MergeStrategy = "sum" | "max";

/** What happens when a metered allowance is exceeded. */
export type OveragePolicy = "hard_cap" | "soft_cap";

// ---------------------------------------------------------------------------
// Entitlement definitions — the registry of all known entitlements
// ---------------------------------------------------------------------------

export type EntitlementDefinition =
    | { type: "boolean"; key: string }
    | { type: "quantity"; key: string; merge: MergeStrategy }
    | { type: "metered"; key: string; merge: MergeStrategy; overagePolicy: OveragePolicy };

/**
 * All entitlement definitions. Adding a new key here automatically extends
 * the EntitlementKey union and forces usage providers to handle it.
 */
export const ENTITLEMENT_DEFINITIONS = {
    can_purchase_additional_seats: { type: "boolean", key: "can_purchase_additional_seats" },
    seats: { type: "quantity", key: "seats", merge: "sum" },
    docs_sites: { type: "quantity", key: "docs_sites", merge: "sum" },
    custom_domain_subpath: { type: "boolean", key: "custom_domain_subpath" },
    ai_credits: { type: "metered", key: "ai_credits", merge: "max", overagePolicy: "hard_cap" },
    number_of_custom_domains: { type: "quantity", key: "number_of_custom_domains", merge: "max" }
} as const satisfies Record<string, EntitlementDefinition>;

/** Union of all valid entitlement keys, derived from definitions. */
export type EntitlementKey = keyof typeof ENTITLEMENT_DEFINITIONS;

/** All numeric entitlement keys */
export type NumericEntitlementKey = {
    [K in keyof typeof ENTITLEMENT_DEFINITIONS]: (typeof ENTITLEMENT_DEFINITIONS)[K] extends { type: "boolean" }
        ? never
        : K;
}[keyof typeof ENTITLEMENT_DEFINITIONS];

export function isNumericEntitlementKey(key: EntitlementKey): key is NumericEntitlementKey {
    return ENTITLEMENT_DEFINITIONS[key].type !== "boolean";
}

// ---------------------------------------------------------------------------
// Grants — what a SKU provides for a specific entitlement
// ---------------------------------------------------------------------------

export type EntitlementGrant =
    | { key: EntitlementKey; type: "boolean"; enabled: boolean }
    | { key: EntitlementKey; type: "quantity"; limit: number }
    | { key: EntitlementKey; type: "metered"; allowance: number };

// ---------------------------------------------------------------------------
// Check results
// ---------------------------------------------------------------------------

export type EntitlementCheckResult =
    | { entitled: true; type: "boolean" }
    | { entitled: true; type: "quantity"; limit: number; used: number; remaining: number }
    | {
          entitled: true;
          type: "metered";
          allowance: number;
          used: number;
          remaining: number;
          overagePolicy: OveragePolicy;
      }
    | { entitled: false; reason: string; limit?: number; used?: number };
