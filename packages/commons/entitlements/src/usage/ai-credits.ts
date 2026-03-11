import { getBillingPeriod } from "@fern-platform/billing";
import { getClient } from "@fern-platform/supabase";

/**
 * Get current AI credit usage for an org by summing credit usage
 * within the current billing period.
 *
 * Uses getBillingPeriod() from the billing package, which returns
 * the subscription's current period or falls back to the last 30 days.
 */
export async function getAiCreditsUsage(orgId: string): Promise<number> {
    const periodResult = await getBillingPeriod(orgId);

    if (periodResult.isErr()) {
        // biome-ignore lint/suspicious/noConsole: usage provider logging
        console.warn(`[entitlements] failed to get billing period for ${orgId}`, periodResult.error);
        return 0;
    }

    const { since, until } = periodResult.value;
    const client = getClient();

    const { data: credits } = await client
        .from("org_fern_credit_usage")
        .select("credits_used")
        .eq("org_id", orgId)
        .gte("created_at", since)
        .lte("created_at", until);

    if (!credits) {
        return 0;
    }

    return credits.reduce((sum, row) => sum + row.credits_used, 0);
}
