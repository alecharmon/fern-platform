"use server";

import { isTrialEnabled } from "@fern-platform/billing";

/**
 * Server action to check if free trials are enabled in the current Stripe environment.
 */
export async function getTrialEnabled(): Promise<boolean> {
    return isTrialEnabled();
}
