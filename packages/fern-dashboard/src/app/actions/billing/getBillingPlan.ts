/**
 * Server action to get the billing plan for an organization.
 * Thin wrapper around @fern-platform/billing's getBillingPlan.
 */

"use server";

import { type BillingPlan, getBillingPlan } from "@fern-platform/billing";

export async function getBillingPlanAction(orgId: string): Promise<{ plan: BillingPlan | null } | { error: string }> {
    try {
        const result = await getBillingPlan(orgId);

        if (result.isErr()) {
            console.error("[getBillingPlanAction] Error:", result.error);
            return { error: result.error.message };
        }

        return { plan: result.value };
    } catch (error: unknown) {
        console.error("[getBillingPlanAction] Unexpected error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get billing plan" };
    }
}
