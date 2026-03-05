"use client";

import type { EntitlementCheckResult, EntitlementKey } from "@fern-platform/entitlements";

import { useEntitlements } from "@/providers/EntitlementsProvider";

/**
 * Returns the full check result for a single entitlement key,
 * plus convenience booleans. Pulls data from EntitlementsProvider context.
 * Fern employees always bypass entitlement gates.
 */
export function useEntitlement(key: EntitlementKey) {
    const { entitlements, isFernEmployee, isLoading, refetch } = useEntitlements();

    if (isFernEmployee) {
        return {
            result: undefined,
            isEntitled: true,
            isLoading: false,
            remaining: Infinity,
            limit: undefined,
            used: undefined,
            refetch
        };
    }

    const result: EntitlementCheckResult | undefined = entitlements?.[key];
    const isEntitled = result?.entitled === true;

    const remaining = result?.entitled === true ? (result.type === "boolean" ? Infinity : result.remaining) : 0;

    const limit =
        result == null
            ? undefined
            : result.entitled === true
              ? result.type === "boolean"
                  ? Infinity
                  : result.type === "quantity"
                    ? result.limit
                    : result.allowance
              : result.limit;

    const used =
        result == null
            ? undefined
            : result.entitled === true
              ? result.type === "boolean"
                  ? 0
                  : result.used
              : result.used;

    return {
        result,
        isEntitled,
        isLoading,
        remaining,
        limit,
        used,
        refetch
    };
}
