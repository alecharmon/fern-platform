"use server";

import {
    ADDON_EXTRA_SEATS_PRICE_ID,
    getActiveSubscription,
    getOrgBillingAccount,
    MAX_ADDON_SEATS
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

        if (seatsToAdd <= 0) {
            return { error: "Must add at least 1 seat" };
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
        const existingItem = stripeSub.items.data.find((item) => item.price.id === ADDON_EXTRA_SEATS_PRICE_ID);

        if (existingItem) {
            await stripe.subscriptionItems.update(existingItem.id, {
                quantity: (existingItem.quantity ?? 0) + seatsToAdd
            });
        } else {
            await stripe.subscriptions.update(stripeSubscriptionId, {
                items: [{ price: ADDON_EXTRA_SEATS_PRICE_ID, quantity: seatsToAdd }]
            });
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[createAddonSeatsCheckout] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to add seats" };
    }
}
