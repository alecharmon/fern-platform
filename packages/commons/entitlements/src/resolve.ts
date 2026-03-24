import { getGrantsForSkus } from "./grants";
import { ENTITLEMENT_DEFINITIONS, type EntitlementDefinition, type EntitlementKey, type MergeStrategy } from "./types";

// ---------------------------------------------------------------------------
// Resolved entitlement — the merged result for a single key
// ---------------------------------------------------------------------------

export type ResolvedGrant =
    | { type: "boolean"; enabled: boolean }
    | { type: "quantity"; limit: number }
    | { type: "metered"; allowance: number };

export type ResolvedEntitlements = Partial<Record<EntitlementKey, ResolvedGrant>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mergeValues(existing: number, incoming: number, strategy: MergeStrategy): number {
    return strategy === "sum" ? existing + incoming : Math.max(existing, incoming);
}

function getMergeStrategy(def: EntitlementDefinition, fallback: MergeStrategy): MergeStrategy {
    if (def.type === "quantity" || def.type === "metered") {
        return def.merge;
    }
    return fallback;
}

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

/**
 * Merge grants from multiple active SKUs into a single resolved entitlement map.
 */
export function resolveEntitlements(skus: string[]): ResolvedEntitlements {
    const grants = getGrantsForSkus(skus);
    const result: ResolvedEntitlements = {};

    for (const grant of grants) {
        const def: EntitlementDefinition = ENTITLEMENT_DEFINITIONS[grant.key];
        const existing = result[grant.key];

        if (grant.type === "boolean") {
            // Once enabled by any SKU, stays enabled (logical OR).
            const prev = existing?.type === "boolean" ? existing.enabled : false;
            result[grant.key] = { type: "boolean", enabled: prev || grant.enabled };
        } else if (grant.type === "quantity") {
            const merge = getMergeStrategy(def, "max");
            const prev = existing?.type === "quantity" ? existing.limit : 0;
            result[grant.key] = { type: "quantity", limit: mergeValues(prev, grant.limit, merge) };
        } else if (grant.type === "metered") {
            const merge = getMergeStrategy(def, "sum");
            const prev = existing?.type === "metered" ? existing.allowance : 0;
            result[grant.key] = { type: "metered", allowance: mergeValues(prev, grant.allowance, merge) };
        }
    }

    // Fold additional_custom_domains into number_of_custom_domains so consumers
    // check a single key. The addon grants are kept separate in the SKU map to
    // avoid changing the base-plan merge strategy (max) for existing customers.
    const additional = result.additional_custom_domains;
    if (additional?.type === "quantity" && additional.limit > 0) {
        const base = result.number_of_custom_domains;
        const baseLimit = base?.type === "quantity" ? base.limit : 0;
        result.number_of_custom_domains = { type: "quantity", limit: baseLimit + additional.limit };
        delete result.additional_custom_domains;
    }

    return result;
}
