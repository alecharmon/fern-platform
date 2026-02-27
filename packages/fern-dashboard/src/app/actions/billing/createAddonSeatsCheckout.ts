"use server";

import {
    getActiveSubscription,
    getOrgBillingAccount,
    MAX_ADDON_SEATS,
    resolveSubscriptionAddonContext
} from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";

export interface CreateAddonSeatsCheckoutParams {
    orgId: string;
    orgName: Auth0OrgName;
    seatsToAdd: number;
}

/**
 * Add addon seats to the existing subscription directly via the Stripe API.
 * If an addon seats item already exists, its quantity is incremented.
 * If not, a new line item is added to the subscription.
 * Returns { success: true } — no redirect or popup needed.
 */
export async function createAddonSeatsCheckout(
    params: CreateAddonSeatsCheckoutParams
): Promise<{ success: true } | { error: string }> {
    try {
        const { orgId, orgName, seatsToAdd } = params;

        if (seatsToAdd === 0) {
            return { error: "No seat change specified" };
        }

        if (seatsToAdd > MAX_ADDON_SEATS) {
            return { error: `Cannot exceed ${MAX_ADDON_SEATS} addon seats` };
        }

        const session = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(session.accessToken, orgName);

        const accountResult = await getOrgBillingAccount(orgId);
        if (accountResult.isErr()) {
            return { error: "Failed to look up billing account" };
        }
        const account = accountResult.value;
        if (!account?.stripe_customer_id) {
            return { error: "No Stripe customer found. Please contact support." };
        }

        const subscriptionResult = await getActiveSubscription(orgId);
        if (subscriptionResult.isErr()) {
            return { error: "Failed to look up subscription" };
        }
        if (!subscriptionResult.value) {
            return { error: "No active subscription found." };
        }

        const stripeSubscriptionId = subscriptionResult.value.stripe_subscription_id;
        const stripe = getStripeClient().getStripeInstance();

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const { targetAddonPriceId, existingItem, existingQuantity } = resolveSubscriptionAddonContext(stripeSub);
        const newQuantity = existingQuantity + seatsToAdd;

        if (newQuantity < 0) {
            return { error: "Cannot remove more addon seats than currently exist" };
        }

        if (newQuantity === 0 && existingItem) {
            await stripe.subscriptionItems.del(existingItem.id, {
                proration_behavior: "create_prorations"
            });
        } else if (existingItem) {
            await stripe.subscriptionItems.update(existingItem.id, {
                quantity: newQuantity,
                proration_behavior: "create_prorations"
            });
        } else if (seatsToAdd > 0) {
            await stripe.subscriptions.update(stripeSubscriptionId, {
                items: [{ price: targetAddonPriceId, quantity: seatsToAdd }]
            });
        } else {
            return { error: "No addon seats to remove" };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[createAddonSeatsCheckout] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to add seats" };
    }
}
