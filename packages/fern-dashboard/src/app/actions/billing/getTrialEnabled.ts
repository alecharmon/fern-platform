"use server";

import { isTrialEnabled } from "@fern-platform/billing";
import { getCurrentSession } from "../../services/auth0/getCurrentSession";

/**
 * Server action to check if free trials are enabled in the current Stripe environment.
 */
export async function getTrialEnabled(): Promise<boolean> {
    const session = await getCurrentSession();
    if (session == null) {
        return false;
    }
    return isTrialEnabled();
}
