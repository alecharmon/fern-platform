/**
 * Server action to create a Stripe billing portal session.
 * Allows users to manage their subscription, payment methods, and invoices.
 */

"use server";

import { getOrgBillingAccount } from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";
import { getAppUrlServerSide } from "@/utils/getAppUrlServerSide";

interface CreatePortalSessionParams {
    orgId: string;
    orgName: Auth0OrgName;
    orgSlug: string;
}

export async function createPortalSession(
    params: CreatePortalSessionParams
): Promise<{ url: string } | { error: string }> {
    try {
        const { orgId, orgName, orgSlug } = params;

        const { accessToken } = await getCurrentSessionOrThrow();
        await assertUserHasOrganizationAccess(accessToken, orgName);

        const stripeClient = getStripeClient();

        // Get Stripe customer ID from org_billing_account
        const accountResult = await getOrgBillingAccount(orgId);
        if (accountResult.isErr()) {
            return { error: "Failed to look up billing account" };
        }

        const account = accountResult.value;
        if (!account?.stripe_customer_id) {
            return { error: "No Stripe customer found for this organization" };
        }

        // Create portal session
        const baseUrl = await getAppUrlServerSide();
        const session = await stripeClient.createPortalSession(
            account.stripe_customer_id,
            `${baseUrl}/${orgSlug}/billing`
        );

        if (!session.url) {
            return { error: "Failed to create portal session" };
        }

        return { url: session.url };
    } catch (error: unknown) {
        console.error("[createPortalSession] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to create portal session" };
    }
}
