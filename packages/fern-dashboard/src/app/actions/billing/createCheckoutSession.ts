/**
 * Server action to create a Stripe checkout session for an organization.
 * Uses @fern-platform/billing for account storage.
 */

"use server";

import { getCheckoutPriceIds, isTrialEnabled, upsertOrgBillingAccount } from "@fern-platform/billing";
import { getStripeClient } from "@/app/services/stripe/client";
import { getAppUrlServerSide } from "@/utils/getAppUrlServerSide";

const TRIAL_DAYS = 14 as const;

export interface CreateCheckoutSessionParams {
    orgId: string;
    orgName: string;
    orgSlug: string;
    userEmail: string;
    billingCycle: "monthly" | "yearly";
    useSuperUserPricing?: boolean;
}

export async function createCheckoutSession(
    params: CreateCheckoutSessionParams
): Promise<{ url: string } | { error: string }> {
    try {
        const { orgId, orgName, orgSlug, userEmail, billingCycle, useSuperUserPricing } = params;

        const priceIds = getCheckoutPriceIds(billingCycle, useSuperUserPricing);

        const stripeClient = getStripeClient();

        // Get or create Stripe customer
        const customer = await stripeClient.getOrCreateCustomer(userEmail, orgName, orgId);

        // Ensure customer ID is cached in org_billing_account
        const upsertResult = await upsertOrgBillingAccount({
            org_id: orgId,
            stripe_customer_id: customer.id
        });
        if (upsertResult.isErr()) {
            console.error("[createCheckoutSession] Failed to upsert billing account:", upsertResult.error);
        }

        // Create checkout session
        const baseUrl = await getAppUrlServerSide();

        const session = await stripeClient.createCheckoutSessionWithPrices(
            customer.id,
            priceIds,
            `${baseUrl}/${orgSlug}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            `${baseUrl}/${orgSlug}/billing?canceled=true`,
            {
                orgId,
                userEmail
            },
            isTrialEnabled() ? TRIAL_DAYS : undefined
        );

        if (!session.url) {
            return { error: "Failed to create checkout session" };
        }

        return { url: session.url };
    } catch (error: unknown) {
        console.error("[createCheckoutSession] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to create checkout session" };
    }
}
