"use client";

import type { ReactNode } from "react";

import { useEntitlementsEnabled } from "@/components/posthog/feature-flags/useEntitlementsEnabled";
import { useEntitlement } from "@/state/useEntitlement";

import { UPSELL_FEATURE_ENTITLEMENT_MAP, type UpsellFeature } from "./types";
import { useUpsell } from "./UpsellProvider";

interface UpsellGateProps {
    feature: UpsellFeature;
    children: ReactNode;
    /** JSX to render while entitlement data is loading. Defaults to children. */
    fallback?: ReactNode;
}

/**
 * Declarative wrapper that gates children behind an entitlement check.
 *
 * - Loading: renders `fallback` if provided, otherwise children.
 * - Entitled: renders children directly, no wrapper DOM element.
 * - Not entitled: wraps children in a relative div with an invisible overlay
 *   that intercepts clicks and opens the upsell modal.
 * - Feature flag off: always passes through.
 */
export function UpsellGate({ feature, children, fallback }: UpsellGateProps) {
    const { openUpsell } = useUpsell();
    const entitlementKey = UPSELL_FEATURE_ENTITLEMENT_MAP[feature];
    const { isEntitled, isLoading } = useEntitlement(entitlementKey);
    const flagEnabled = useEntitlementsEnabled();

    // Feature flag off — always pass through
    if (flagEnabled === false) {
        return <>{children}</>;
    }

    // Still loading — show fallback if provided, otherwise pulse the children
    if (isLoading) {
        return fallback != null ? (
            <>{fallback}</>
        ) : (
            <div className="animate-pulse opacity-50 pointer-events-none">{children}</div>
        );
    }

    // Entitled — transparent passthrough
    if (isEntitled) {
        return <>{children}</>;
    }

    // Not entitled — intercept clicks
    return (
        <div className="relative">
            {children}
            <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openUpsell(feature);
                }}
                role="presentation"
                aria-label={`Upgrade required for ${feature.replace(/_/g, " ")}`}
            />
        </div>
    );
}
