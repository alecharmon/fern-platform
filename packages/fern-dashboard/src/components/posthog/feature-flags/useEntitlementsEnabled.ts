"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";

import { useEntitlements } from "@/providers/EntitlementsProvider";
import { PosthogFeatureFlag } from "./flags";

/**
 * Single accessor for the ENABLE_ENTITLEMENTS feature flag on the client.
 *
 * PostHog already has the current user and org registered as person properties
 * (via posthog.identify + setPersonPropertiesForFlags in PostHogProvider), so
 * useFeatureFlagEnabled evaluates against the correct user+org automatically
 * without needing an extra server call or org lookup.
 *
 * Fern employees always bypass entitlement gates (returns false) so internal
 * users are never blocked by upsell gates during testing and development.
 *
 * Returns:
 *   - true  — flag is on, entitlements are enforced
 *   - false — flag is off, entitlements are bypassed
 *   - undefined — flag not yet loaded
 */
export function useEntitlementsEnabled(): boolean | undefined {
    const { isFernEmployee } = useEntitlements();
    const flagValue = useFeatureFlagEnabled(PosthogFeatureFlag.ENABLE_ENTITLEMENTS);

    if (isFernEmployee) {
        return false; // Fern employees always bypass entitlement gates
    }

    return flagValue;
}
