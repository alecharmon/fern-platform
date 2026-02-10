/**
 * Server action for creating upgrade portal sessions.
 * Uses Stripe billing portal with subscription_update_confirm flow.
 */

"use server";

import { getActiveSubscription, getOrgBillingAccount } from "@fern-platform/billing";
import { getStripeClient } from "@/app/services/stripe/client";

export interface CreateUpgradeSessionParams {
    orgId: string;
    orgSlug: string;
    priceIds: string[];
    baseUrl: string;
}

export interface CreateUpgradeSessionResult {
    url: string;
}

/**
 * Create a billing portal session pre-configured for a specific plan upgrade.
 * Redirects user to Stripe portal confirmation page for the upgrade.
 */
export async function createUpgradeSession(
    params: CreateUpgradeSessionParams
): Promise<CreateUpgradeSessionResult | { error: string }> {
    try {
        const { orgId, orgSlug, priceIds, baseUrl } = params;

        if (!priceIds || priceIds.length === 0) {
            return { error: "No prices selected" };
        }

        // Get billing account
        const accountResult = await getOrgBillingAccount(orgId);
        if (accountResult.isErr()) {
            return { error: "Failed to look up billing account" };
        }
        const account = accountResult.value;
        if (!account?.stripe_customer_id) {
            return { error: "No Stripe customer found. Please contact support." };
        }

        // Get active subscription
        const subscriptionResult = await getActiveSubscription(orgId);
        if (subscriptionResult.isErr()) {
            return { error: "Failed to look up subscription" };
        }
        const subscription = subscriptionResult.value;
        if (!subscription) {
            return { error: "No active subscription found. Please use checkout for new subscriptions." };
        }

        const stripeClient = getStripeClient();
        const returnUrl = `${baseUrl}/${orgSlug}/billing?upgrade=true`;

        const session = await stripeClient.createUpgradePortalSession(
            account.stripe_customer_id,
            subscription.stripe_subscription_id,
            priceIds,
            returnUrl
        );

        return { url: session.url };
    } catch (error: unknown) {
        console.error("[createUpgradeSession] Error:", error);

        if (error instanceof Error && "type" in error && (error as any).type === "StripeInvalidRequestError") {
            if (error.message?.includes("No such subscription")) {
                return { error: "Subscription not found. It may have been canceled." };
            }
            if (error.message?.includes("No such price")) {
                return { error: "Invalid plan selected. Please refresh and try again." };
            }
        }

        return { error: error instanceof Error ? error.message : "Failed to create upgrade session" };
    }
}
