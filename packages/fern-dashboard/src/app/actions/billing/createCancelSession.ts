/**
 * Server action to create a Stripe billing portal session for subscription cancellation.
 * Opens the portal directly to the cancellation flow.
 */

"use server";

import { getActiveSubscription, getOrgBillingAccount } from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";
import { getAppUrlServerSide } from "@/utils/getAppUrlServerSide";

interface CreateCancelSessionParams {
    orgId: string;
    orgName: Auth0OrgName;
    orgSlug: string;
}

export async function createCancelSession(
    params: CreateCancelSessionParams
): Promise<{ url: string } | { error: string }> {
    try {
        const { orgId, orgName, orgSlug } = params;

        const { accessToken } = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(accessToken, orgName);

        const accountResult = await getOrgBillingAccount(orgId);
        if (accountResult.isErr()) {
            return { error: "Failed to look up billing account" };
        }

        const account = accountResult.value;
        if (!account?.stripe_customer_id) {
            return { error: "No Stripe customer found for this organization" };
        }

        const subscriptionResult = await getActiveSubscription(orgId);
        if (subscriptionResult.isErr()) {
            return { error: "Failed to look up subscription" };
        }

        const subscription = subscriptionResult.value;
        if (!subscription) {
            return { error: "No active subscription found" };
        }

        const stripeClient = getStripeClient();
        const baseUrl = await getAppUrlServerSide();

        const session = await stripeClient.createCancelPortalSession(
            account.stripe_customer_id,
            subscription.stripe_subscription_id,
            `${baseUrl}/${orgSlug}/billing`
        );

        if (!session.url) {
            return { error: "Failed to create cancellation session" };
        }

        return { url: session.url };
    } catch (error: unknown) {
        console.error("[createCancelSession] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to create cancellation session" };
    }
}
