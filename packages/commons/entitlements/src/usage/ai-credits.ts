import { getClient } from "@fern-platform/supabase";

/**
 * Get current AI credit usage for an org by summing credit usage
 * within the current billing period (from org_subscription).
 *
 * Returns 0 if no active subscription or no billing period dates.
 */
export async function getAiCreditsUsage(orgId: string): Promise<number> {
    const client = getClient();

    // Get current billing period from the active subscription
    const { data: subscription } = await client
        .from("org_subscription")
        .select("current_period_start, current_period_end")
        .eq("org_id", orgId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!subscription?.current_period_start || !subscription?.current_period_end) {
        return 0;
    }

    // Sum credit usage within the billing period
    const { data: credits } = await client
        .from("org_fern_credit_usage")
        .select("credits_used")
        .eq("org_id", orgId)
        .gte("created_at", subscription.current_period_start)
        .lte("created_at", subscription.current_period_end);

    if (!credits) {
        return 0;
    }

    return credits.reduce((sum, row) => sum + row.credits_used, 0);
}
