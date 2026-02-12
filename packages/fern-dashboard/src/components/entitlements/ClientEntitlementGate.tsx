"use client";

import type { EntitlementKey } from "@fern-platform/entitlements";
import { usePostHog } from "posthog-js/react";
import type { ReactNode } from "react";

import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { useEntitlements } from "@/providers/EntitlementsProvider";

import { EntitlementGate } from "./EntitlementGate";

interface ClientEntitlementGateProps {
    required: EntitlementKey | EntitlementKey[];
    mode?: "all" | "any";
    children: ReactNode;
    fallback?: ReactNode;
    /**
     * What to render while entitlements are still loading.
     * Defaults to nothing (hides children until loaded).
     */
    loading?: ReactNode;
}

/**
 * Client-side convenience wrapper — pulls entitlements from context
 * so callers don't need to thread the data through props.
 * Entitlement enforcement is gated behind the ENABLE_ENTITLEMENTS feature flag.
 */
export function ClientEntitlementGate({
    required,
    mode,
    children,
    fallback,
    loading: loadingNode = null
}: ClientEntitlementGateProps) {
    const { entitlements, isLoading } = useEntitlements();
    const posthog = usePostHog();
    const enabled = posthog?.isFeatureEnabled(PosthogFeatureFlag.ENABLE_ENTITLEMENTS) ?? false;

    if (!enabled) {
        return <>{children}</>;
    }

    if (isLoading || !entitlements) {
        return <>{loadingNode}</>;
    }

    return (
        <EntitlementGate
            entitlements={entitlements}
            required={required}
            mode={mode}
            fallback={fallback}
            enabled={enabled}
        >
            {children}
        </EntitlementGate>
    );
}
