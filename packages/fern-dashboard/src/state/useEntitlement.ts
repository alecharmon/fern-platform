"use client";

import type { EntitlementCheckResult, EntitlementKey } from "@fern-platform/entitlements";
import { usePostHog } from "posthog-js/react";

import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { useEntitlements } from "@/providers/EntitlementsProvider";

/**
 * Returns the full check result for a single entitlement key,
 * plus convenience booleans. Pulls data from EntitlementsProvider context.
 * Gated behind the ENABLE_ENTITLEMENTS feature flag — when the flag is off,
 * always reports as entitled with Infinity remaining.
 */
export function useEntitlement(key: EntitlementKey) {
    const { entitlements, isLoading, refetch } = useEntitlements();
    const posthog = usePostHog();
    const enabled = posthog?.isFeatureEnabled(PosthogFeatureFlag.ENABLE_ENTITLEMENTS) ?? false;

    if (!enabled) {
        return {
            result: undefined,
            isEntitled: true,
            isLoading: false,
            remaining: Infinity,
            refetch
        };
    }

    const result: EntitlementCheckResult | undefined = entitlements?.[key];
    const isEntitled = result?.entitled === true;

    const remaining = result?.entitled === true ? (result.type === "boolean" ? Infinity : result.remaining) : 0;

    return {
        result,
        isEntitled,
        isLoading,
        remaining,
        refetch
    };
}
