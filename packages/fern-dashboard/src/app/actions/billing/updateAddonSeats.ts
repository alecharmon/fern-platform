"use server";

import {
    getActiveSubscription,
    getOrgBillingAccount,
    MAX_ADDON_SEATS,
    MAX_PRO_TOTAL_SEATS,
    resolveSubscriptionAddonContext
} from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";

export interface UpdateAddonSeatsParams {
    orgId: string;
    orgName: Auth0OrgName;
    quantity: number;
}

/**
 * Set the addon seat quantity on the org's existing subscription via the Stripe API.
 * If quantity is 0, removes the addon item entirely.
 * If the addon price doesn't exist yet and quantity > 0, creates a new subscription item.
 */
export async function updateAddonSeats(params: UpdateAddonSeatsParams): Promise<{ success: true } | { error: string }> {
    try {
        const { orgId, orgName, quantity } = params;

        const session = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(session.accessToken, orgName);

        if (quantity < 0) {
            return { error: "Quantity cannot be negative" };
        }

        if (quantity > MAX_ADDON_SEATS) {
            return { error: `Cannot exceed ${MAX_ADDON_SEATS} addon seats` };
        }

        if (quantity > MAX_PRO_TOTAL_SEATS) {
            return { error: `Pro plan supports up to ${MAX_PRO_TOTAL_SEATS} total seats. Contact sales for more.` };
        }

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
        const subscription = subscriptionResult.value;
        if (!subscription) {
            return { error: "No active subscription found." };
        }

        const stripe = getStripeClient().getStripeInstance();

        const sub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

        const { targetAddonPriceId, existingItem } = resolveSubscriptionAddonContext(sub);

        if (quantity === 0) {
            if (existingItem) {
                await stripe.subscriptionItems.del(existingItem.id, {
                    proration_behavior: "create_prorations"
                });
            }
        } else if (existingItem) {
            await stripe.subscriptionItems.update(existingItem.id, {
                quantity,
                proration_behavior: "create_prorations"
            });
        } else {
            await stripe.subscriptionItems.create({
                subscription: subscription.stripe_subscription_id,
                price: targetAddonPriceId,
                quantity
            });
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[updateAddonSeats] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to update seats" };
    }
}
