"use server";

import {
    getActiveSubscription,
    getAllAddonSeatsPriceIds,
    getOrgBillingAccount,
    MAX_ADDON_SEATS,
    resolveSubscriptionAddonContext,
    type Stripe
} from "@fern-platform/billing";
import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getStripeClient } from "@/app/services/stripe/client";

export interface AddonSeatsPricePreview {
    /** Recurring cost per seat per billing interval, in cents (includes tax) */
    perSeatCost: number;
    /** Billing interval detected from the subscription's base plan: "month" or "year" */
    billingInterval: "month" | "year";
    /** ISO currency code e.g. "usd" */
    currency: string;
    /** Current recurring subtotal before tax, in cents */
    currentRecurringSubtotal: number;
    /** Seat delta amount before tax, in cents (positive for adding, negative for removing) */
    seatDeltaSubtotal: number;
    /** Tax delta from the seat change, in cents */
    taxDelta: number;
    /** New recurring total after seat change (with tax), in cents */
    newRecurringTotal: number;
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

        const { billingInterval, targetAddonPriceId, existingItem, existingQuantity } =
            resolveSubscriptionAddonContext(stripeSub);
        const addonSeatsPriceIds = getAllAddonSeatsPriceIds();
        const newQuantity = existingQuantity + seatsToAdd;

        if (newQuantity < 0) {
            return { error: "Cannot remove more addon seats than currently exist" };
        }

        let subscriptionItems: Stripe.InvoiceCreatePreviewParams.SubscriptionDetails.Item[];
        if (newQuantity === 0 && existingItem) {
            subscriptionItems = [{ id: existingItem.id, deleted: true }];
        } else if (existingItem) {
            subscriptionItems = [{ id: existingItem.id, quantity: newQuantity }];
        } else if (seatsToAdd > 0) {
            subscriptionItems = [{ price: targetAddonPriceId, quantity: seatsToAdd }];
        } else {
            return { error: "No addon seats to remove" };
        }

        // Fetch both the current upcoming invoice and the modified preview
        // to compute the incremental charge for just the seat change
        const [currentInvoice, modifiedInvoice] = await Promise.all([
            stripe.invoices.createPreview({
                customer: account.stripe_customer_id,
                subscription: stripeSubscriptionId
            }),
            stripe.invoices.createPreview({
                customer: account.stripe_customer_id,
                subscription: stripeSubscriptionId,
                subscription_details: { items: subscriptionItems }
            })
        ]);

        // Find the non-proration recurring line for the addon seats price
        // In Stripe v20, proration and price moved to the parent nested object
        const findAddonRecurringLine = (invoice: typeof modifiedInvoice) =>
            invoice.lines.data.find((line: Stripe.InvoiceLineItem) => {
                const isProration =
                    line.parent?.invoice_item_details?.proration || line.parent?.subscription_item_details?.proration;
                const priceId =
                    typeof line.pricing?.price_details?.price === "string"
                        ? line.pricing.price_details.price
                        : line.pricing?.price_details?.price?.id;
                return !isProration && priceId != null && addonSeatsPriceIds.includes(priceId);
            });

        // When removing ALL addon seats the modified invoice has no addon line,
        // so fall back to the current invoice to derive per-seat cost.
        const recurringLine = findAddonRecurringLine(modifiedInvoice) ?? findAddonRecurringLine(currentInvoice);

        // Derive tax amounts from both invoices
        const modifiedTax = modifiedInvoice.total - (modifiedInvoice.total_excluding_tax ?? modifiedInvoice.total);
        const currentTax = currentInvoice.total - (currentInvoice.total_excluding_tax ?? currentInvoice.total);
        const dueNowTax = modifiedTax - currentTax;

        // Derive effective tax rate from the modified invoice (0 if Stripe Tax not configured)
        const taxRate = modifiedInvoice.subtotal > 0 && modifiedTax > 0 ? modifiedTax / modifiedInvoice.subtotal : 0;

        // Recurring cost per seat including tax (no annualization needed — yearly has its own price)
        const denominator = recurringLine ? (recurringLine.quantity ?? newQuantity) : 0;
        const basePricePerSeat = recurringLine && denominator > 0 ? Math.round(recurringLine.amount / denominator) : 0;
        const perSeatCost = Math.round(basePricePerSeat * (1 + taxRate));

        // Compute recurring totals for the breakdown display
        // currentInvoice (no modifications) = current recurring charges
        const currentRecurringSubtotal = currentInvoice.subtotal;
        const seatDeltaSubtotal = Math.round(basePricePerSeat * seatsToAdd);
        const taxDelta = dueNowTax;
        const newRecurringTotal = currentInvoice.total + perSeatCost * seatsToAdd;

        return {
            preview: {
                perSeatCost,
                billingInterval,
                currency: modifiedInvoice.currency,
                currentRecurringSubtotal,
                seatDeltaSubtotal,
                taxDelta,
                newRecurringTotal
            }
        };
    } catch (error: unknown) {
        console.error("[getAddonSeatsPricePreview] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to load price preview" };
    }
}
