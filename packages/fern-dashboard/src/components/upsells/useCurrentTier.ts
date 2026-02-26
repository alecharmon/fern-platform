"use client";

import type { ProductTier } from "@fern-platform/billing";
import { useQuery } from "@tanstack/react-query";

import { getBillingPlanAction } from "@/app/actions/billing/getBillingPlan";
import { useCurrentOrganization } from "@/state/useOrganizations";

/**
 * Returns the current org's billing tier: "free" | "paid" | "enterprise".
 * Returns `undefined` while the billing query is in flight to avoid flickering
 * from an incorrect "free" default before the real tier is known.
 * Defaults to "free" on error or when no plan is found.
 */
export function useCurrentTier(): ProductTier | undefined {
    const org = useCurrentOrganization();

    const { data, isLoading } = useQuery({
        queryKey: ["billingPlan", org?.id],
        queryFn: () => (org?.id ? getBillingPlanAction(org.id) : Promise.resolve({ plan: null })),
        enabled: !!org?.id,
        staleTime: 5 * 60 * 1000
    });

    if (isLoading) {
        return undefined;
    }

    if (!data || "error" in data || !data.plan) {
        return "free";
    }

    return data.plan.tier;
}
