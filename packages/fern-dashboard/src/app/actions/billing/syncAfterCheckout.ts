/**
 * Server action to sync billing data immediately after checkout or upgrade.
 * Avoids waiting for the async Stripe webhook to fire.
 */

"use server";

import { getOrgBillingAccount, syncSubscriptionFromStripe } from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";

interface SyncAfterCheckoutParams {
    orgId: string;
    orgName: Auth0OrgName;
    /** Stripe checkout session ID — present after new checkout flow */
    checkoutSessionId?: string;
}

export async function syncAfterCheckout(
    params: SyncAfterCheckoutParams
): Promise<{ success: true } | { error: string }> {
    try {
        const { orgId, orgName, checkoutSessionId } = params;

        const { accessToken } = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(accessToken, orgName);

        const stripeClient = getStripeClient();
        const stripe = stripeClient.getStripeInstance();

        if (checkoutSessionId) {
            // New checkout: retrieve the session to get the subscription ID
            const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
            const subscriptionId =
                typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

            if (!subscriptionId) {
                return { error: "Checkout session has no subscription" };
            }

            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const result = await syncSubscriptionFromStripe(subscription);

            if (result.isErr()) {
                console.error("[syncAfterCheckout] Sync failed:", result.error);
                return { error: result.error.message };
            }

            return { success: true };
        }

        // Upgrade flow (billing portal): sync all subscriptions for the org's customer
        const accountResult = await getOrgBillingAccount(orgId);
        if (accountResult.isErr()) {
            return { error: "Failed to look up billing account" };
        }

        const account = accountResult.value;
        if (!account?.stripe_customer_id) {
            return { error: "No billing account found" };
        }

        const subscriptions = await stripe.subscriptions.list({
            customer: account.stripe_customer_id,
            limit: 10
        });

        for (const sub of subscriptions.data) {
            const result = await syncSubscriptionFromStripe(sub);
            if (result.isErr()) {
                console.error("[syncAfterCheckout] Sync failed for subscription:", sub.id, result.error);
            }
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[syncAfterCheckout] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to sync billing" };
    }
}
