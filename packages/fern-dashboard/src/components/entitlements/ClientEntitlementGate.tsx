"use client";

import type { EntitlementKey } from "@fern-platform/entitlements";
import type { ReactNode } from "react";

import { useEntitlementsEnabled } from "@/components/posthog/feature-flags/useEntitlementsEnabled";
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
    const flagValue = useEntitlementsEnabled();

    if (flagValue === false) {
        return <>{children}</>;
    }

    if (flagValue === undefined || isLoading || !entitlements) {
        return <>{loadingNode}</>;
    }

    return (
        <EntitlementGate
            entitlements={entitlements}
            required={required}
            mode={mode}
            fallback={fallback}
            enabled={flagValue === true}
        >
            {children}
        </EntitlementGate>
    );
}
