import { getOrgBillingAccount } from "@fern-platform/billing";
import { cacheLife, cacheTag } from "next/cache";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getStripeClient } from "@/app/services/stripe/client";

import { BillingOrgAlert } from "./BillingOrgAlert";

export function getBillingAlertCacheTag(orgId: string): string {
    return `billing-alert-${orgId}`;
}

interface HeaderBillingAlertProps {
    orgName: Auth0OrgName;
}

export async function HeaderBillingAlert({ orgName }: HeaderBillingAlertProps) {
    const orgId = await getOrgIdFromName(orgName);
    const alert = await getCachedBillingAlertStatus(orgId);

    if (alert == null) {
        return null;
    }

    const session = await getCurrentSession();
    const userEmail = session?.user.email ?? undefined;

    switch (alert.type) {
        case "trial_ending":
            return (
                <BillingOrgAlert
                    variant="warning"
                    message={`Team trial ends in ${alert.daysRemaining} day${alert.daysRemaining === 1 ? "" : "s"}`}
                    actionLabel="Add payment"
                    actionType="checkout"
                    userEmail={userEmail}
                />
            );
        case "trial_ended":
            return (
                <BillingOrgAlert
                    variant="danger"
                    message="Team trial ended"
                    actionLabel="Add payment"
                    actionType="checkout"
                    userEmail={userEmail}
                />
            );
        case "payment_failed":
            return (
                <BillingOrgAlert
                    variant="danger"
                    message="Recent payment has failed"
                    actionLabel="Update payment"
                    actionType="portal"
                />
            );
    }
}

type BillingAlertStatus =
    | { type: "trial_ending"; daysRemaining: number }
    | { type: "trial_ended" }
    | { type: "payment_failed" };

async function getCachedBillingAlertStatus(orgId: string): Promise<BillingAlertStatus | null> {
    "use cache";
    cacheTag(getBillingAlertCacheTag(orgId));
    cacheLife({ revalidate: 60 * 5 });
    return getBillingAlertStatus(orgId);
}

async function getBillingAlertStatus(orgId: string): Promise<BillingAlertStatus | null> {
    try {
        const accountResult = await getOrgBillingAccount(orgId);
        if (accountResult.isErr() || !accountResult.value?.stripe_customer_id) {
            return null;
        }

        const stripe = getStripeClient().getStripeInstance();
        const subscriptions = await stripe.subscriptions.list({
            customer: accountResult.value.stripe_customer_id,
            limit: 10
        });

        // Priority 1: Payment failed
        const pastDue = subscriptions.data.find((sub) => sub.status === "past_due");
        if (pastDue) {
            return { type: "payment_failed" };
        }

        // Priority 2: Trial ending within 7 days (only if no payment method on file)
        const trialing = subscriptions.data.find((sub) => sub.status === "trialing");
        if (trialing?.trial_end) {
            const daysRemaining = Math.ceil((trialing.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysRemaining <= 7 && daysRemaining > 0) {
                const paymentMethods = await stripe.paymentMethods.list({
                    customer: accountResult.value.stripe_customer_id,
                    limit: 1
                });
                if (paymentMethods.data.length === 0) {
                    return { type: "trial_ending", daysRemaining };
                }
            }
        }

        // Priority 3: No active subscriptions but has billing account → trial ended
        const hasActive = subscriptions.data.some((sub) => ["active", "trialing", "past_due"].includes(sub.status));
        if (!hasActive) {
            return { type: "trial_ended" };
        }

        return null;
    } catch (error) {
        console.error("[HeaderBillingAlert] Failed to fetch subscription status:", error);
        return null;
    }
}
