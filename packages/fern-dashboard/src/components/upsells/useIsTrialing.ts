"use client";

import { useQuery } from "@tanstack/react-query";

import { getBillingPlanAction } from "@/app/actions/billing/getBillingPlan";
import { useCurrentOrganization } from "@/state/useOrganizations";

/**
 * Returns true if the org's current subscription is in a trial period.
 * Reuses the same React Query cache as useCurrentTier.
 */
export function useIsTrialing(): boolean | undefined {
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
        return false;
    }

    return data.plan.status === "trialing";
}
