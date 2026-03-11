import { err, ok, type Result } from "neverthrow";
import { getActiveSubscription } from "../db/subscriptions";
import type { BillingError } from "../errors";
import { ensureBillingAccount } from "./ensure-billing-account";

export interface BillingPeriod {
    since: string;
    until: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Get the current billing period for an org.
 *
 * If the org has an active subscription, returns its current_period_start/end.
 * Otherwise, ensures a billing account exists (backfill) and falls back to the last 30 days.
 */
export async function getBillingPeriod(orgId: string): Promise<Result<BillingPeriod, BillingError>> {
    const subResult = await getActiveSubscription(orgId);

    if (subResult.isErr()) {
        // biome-ignore lint/suspicious/noConsole: billing period logging
        console.error(`[billing] failed to get subscription for ${orgId}`, subResult.error);
        return err(subResult.error);
    }

    const subscription = subResult.value;

    if (subscription?.current_period_start && subscription?.current_period_end) {
        return ok({
            since: subscription.current_period_start,
            until: subscription.current_period_end
        });
    }

    // No subscription — backfill billing account (creates Stripe customer if missing)
    const accountResult = await ensureBillingAccount(orgId);
    if (accountResult.isErr()) {
        // biome-ignore lint/suspicious/noConsole: billing backfill logging
        console.error(`[billing] failed to backfill billing account for ${orgId}`, accountResult.error);
    }

    // Fall back to last 30 days
    return ok({
        since: new Date(Date.now() - THIRTY_DAYS_MS).toISOString(),
        until: new Date().toISOString()
    });
}
