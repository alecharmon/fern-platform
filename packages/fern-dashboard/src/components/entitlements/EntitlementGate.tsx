import type { EntitlementCheckResult, EntitlementKey } from "@fern-platform/entitlements";
import type { ReactNode } from "react";

interface EntitlementGateProps {
    entitlements: Record<EntitlementKey, EntitlementCheckResult>;
    required: EntitlementKey | EntitlementKey[];
    mode?: "all" | "any";
    /** When false, bypasses the entitlement check and always renders children. */
    enabled?: boolean;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Environment-agnostic entitlement gate.
 * Works in both server and client components — the caller provides entitlements.
 */
export function EntitlementGate({
    entitlements,
    required,
    mode = "all",
    enabled = true,
    children,
    fallback = null
}: EntitlementGateProps) {
    if (!enabled) {
        return <>{children}</>;
    }

    const keys = Array.isArray(required) ? required : [required];
    const check = (key: EntitlementKey) => entitlements[key]?.entitled === true;
    const has = mode === "all" ? keys.every(check) : keys.some(check);
    return has ? <>{children}</> : <>{fallback}</>;
}
