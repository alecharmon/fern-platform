"use client";

import type { EntitlementKey } from "@fern-platform/entitlements";
import type { ReactNode } from "react";

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
 */
export function ClientEntitlementGate({
    required,
    mode,
    children,
    fallback,
    loading: loadingNode = null
}: ClientEntitlementGateProps) {
    const { entitlements, isLoading } = useEntitlements();

    if (isLoading || !entitlements) {
        return <>{loadingNode}</>;
    }

    return (
        <EntitlementGate entitlements={entitlements} required={required} mode={mode} fallback={fallback} enabled={true}>
            {children}
        </EntitlementGate>
    );
}
