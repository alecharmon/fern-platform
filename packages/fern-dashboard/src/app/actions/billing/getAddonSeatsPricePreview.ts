"use server";

import {
    ADDON_EXTRA_SEATS_PRICE_ID,
    getActiveSubscription,
    getOrgBillingAccount,
    MAX_ADDON_SEATS,
    type Stripe
} from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";

export interface AddonSeatsPricePreview {
    /** Prorated charge due immediately, in cents (includes tax) */
    dueNow: number;
    /** Tax portion of dueNow, in cents (0 if Stripe Tax not configured) */
    dueNowTax: number;
    /** Base charge before tax, in cents */
    subtotal: number;
    /** Recurring monthly cost per added seat, in cents (includes tax) */
    monthlyPerSeat: number;
    /** ISO currency code e.g. "usd" */
    currency: string;
}

export interface GetAddonSeatsPricePreviewParams {
    orgId: string;
    orgName: Auth0OrgName;
    seatsToAdd: number;
}

/**
 * Preview what the customer would be charged if they added N addon seats.
 * Calls stripe.invoices.createPreview() — no charge is made.
 */
export async function getAddonSeatsPricePreview(
    params: GetAddonSeatsPricePreviewParams
): Promise<{ preview: AddonSeatsPricePreview } | { error: string }> {
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
            return { error: "No Stripe customer found" };
        }

        const subscriptionResult = await getActiveSubscription(orgId);
        if (subscriptionResult.isErr()) {
            return { error: "Failed to look up subscription" };
        }
        if (!subscriptionResult.value) {
            return { error: "No active subscription found" };
        }

        const stripeSubscriptionId = subscriptionResult.value.stripe_subscription_id;
        const stripe = getStripeClient().getStripeInstance();

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const existingItem = stripeSub.items.data.find((item) => item.price.id === ADDON_EXTRA_SEATS_PRICE_ID);

        const subscriptionItems = existingItem
            ? [{ id: existingItem.id, quantity: (existingItem.quantity ?? 0) + seatsToAdd }]
            : [{ price: ADDON_EXTRA_SEATS_PRICE_ID, quantity: seatsToAdd }];

        const upcomingInvoice = await stripe.invoices.createPreview({
            customer: account.stripe_customer_id,
            subscription: stripeSubscriptionId,
            subscription_details: { items: subscriptionItems }
        });

        const totalNewQuantity = (existingItem?.quantity ?? 0) + seatsToAdd;

        // Find the non-proration recurring line for the addon seats price
        // In Stripe v20, proration and price moved to the parent nested object
        const recurringLine = upcomingInvoice.lines.data.find((line: Stripe.InvoiceLineItem) => {
            const isProration =
                line.parent?.invoice_item_details?.proration || line.parent?.subscription_item_details?.proration;
            const priceId =
                typeof line.pricing?.price_details?.price === "string"
                    ? line.pricing.price_details.price
                    : line.pricing?.price_details?.price?.id;
            return !isProration && priceId === ADDON_EXTRA_SEATS_PRICE_ID;
        });

        // Derive tax amount from invoice (0 if Stripe Tax not configured)
        // In Stripe v20, the top-level `tax` field was removed; use total - total_excluding_tax
        const dueNowTax = upcomingInvoice.total - (upcomingInvoice.total_excluding_tax ?? upcomingInvoice.total);

        // Derive effective tax rate from the invoice (0 if Stripe Tax not configured)
        const taxRate = upcomingInvoice.subtotal > 0 && dueNowTax > 0 ? dueNowTax / upcomingInvoice.subtotal : 0;

        // Monthly cost per added seat including tax
        const denominator = recurringLine ? (recurringLine.quantity ?? totalNewQuantity) : 0;
        const basePricePerSeat = recurringLine && denominator > 0 ? Math.round(recurringLine.amount / denominator) : 0;
        const monthlyPerSeat = Math.round(basePricePerSeat * (1 + taxRate));

        return {
            preview: {
                dueNow: upcomingInvoice.total,
                dueNowTax,
                subtotal: upcomingInvoice.subtotal,
                monthlyPerSeat,
                currency: upcomingInvoice.currency
            }
        };
    } catch (error: unknown) {
        console.error("[getAddonSeatsPricePreview] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to load price preview" };
    }
}
