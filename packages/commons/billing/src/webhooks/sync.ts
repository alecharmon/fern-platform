import { err, ok, type Result } from "neverthrow";
import type Stripe from "stripe";

import { getOrgBillingAccountByCustomerId, upsertOrgBillingAccount } from "../db/accounts";
import { getProductBySku } from "../db/products";
import {
    deleteSubscriptionItemsNotIn,
    upsertSubscriptionByStripeId,
    upsertSubscriptionItem
} from "../db/subscriptions";
import { type BillingError, billingError } from "../errors";
import { getStripeClient } from "../stripe/client";

export interface SyncResult {
    orgId: string;
    subscriptionId: string;
    itemCount: number;
}

/**
 * Sync subscription data from Stripe to database.
 */
export async function syncSubscriptionFromStripe(
    stripeSubscription: Stripe.Subscription
): Promise<Result<SyncResult, BillingError>> {
    const customerId =
        typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;

    const accountResult = await getOrgBillingAccountByCustomerId(customerId);
    if (accountResult.isErr()) {
        return err(accountResult.error);
    }

    const account = accountResult.value;
    if (!account) {
        return err(billingError("NOT_FOUND", `No billing account found for Stripe customer ${customerId}`));
    }

    const orgId = account.org_id;

    const subscriptionResult = await upsertSubscriptionByStripeId({
        org_id: orgId,
        stripe_subscription_id: stripeSubscription.id,
        status: stripeSubscription.status
    });

    if (subscriptionResult.isErr()) {
        return err(subscriptionResult.error);
    }

    const subscription = subscriptionResult.value;
    const stripeItemIds: string[] = [];

    for (const item of stripeSubscription.items.data) {
        const productId = typeof item.price.product === "string" ? item.price.product : item.price.product.id;

        const stripe = getStripeClient();
        const stripeProduct = await stripe.products.retrieve(productId);
        const sku = stripeProduct.metadata?.sku;

        if (!sku) {
            // biome-ignore lint/suspicious/noConsole: billing logging
            console.warn("[stripe-billing] subscription item does not have sku", productId, item);
            continue;
        }

        const productResult = await getProductBySku(sku);
        if (productResult.isErr()) {
            return err(productResult.error);
        }

        const product = productResult.value;
        if (!product) {
            continue;
        }

        const itemResult = await upsertSubscriptionItem({
            org_subscription_id: subscription.id,
            org_billing_product: product.id,
            stripe_subscription_item_id: item.id,
            quantity: item.quantity ?? 1
        });

        if (itemResult.isErr()) {
            return err(itemResult.error);
        }

        stripeItemIds.push(item.id);
    }

    const deleteResult = await deleteSubscriptionItemsNotIn(subscription.id, stripeItemIds);
    if (deleteResult.isErr()) {
        return err(deleteResult.error);
    }

    return ok({
        orgId,
        subscriptionId: subscription.id,
        itemCount: stripeItemIds.length
    });
}

export interface CustomerUpdateResult {
    customerId: string;
    previousOrgId: string | null;
    newOrgId: string;
    changed: boolean;
}

/**
 * Create or link a billing account when a Stripe customer is created.
 */
export async function syncCustomerFromStripe(
    stripeCustomer: Stripe.Customer,
    orgId: string
): Promise<Result<{ orgId: string }, BillingError>> {
    const result = await upsertOrgBillingAccount({
        org_id: orgId,
        stripe_customer_id: stripeCustomer.id
    });

    if (result.isErr()) {
        return err(result.error);
    }

    return ok({ orgId });
}

/**
 * Handle customer.updated event - updates org_id if it changed in metadata.
 */
export async function syncCustomerUpdateFromStripe(
    stripeCustomer: Stripe.Customer,
    newOrgId: string
): Promise<Result<CustomerUpdateResult, BillingError>> {
    const customerId = stripeCustomer.id;

    const existingResult = await getOrgBillingAccountByCustomerId(customerId);
    if (existingResult.isErr()) {
        return err(existingResult.error);
    }

    const existing = existingResult.value;
    const previousOrgId = existing?.org_id ?? null;

    if (previousOrgId === newOrgId) {
        return ok({
            customerId,
            previousOrgId,
            newOrgId,
            changed: false
        });
    }

    if (existing) {
        const client = (await import("@fern-platform/supabase")).getClient();
        const { error } = await client.from("org_billing_account").delete().eq("stripe_customer_id", customerId);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to remove old billing account: ${error.message}`, error));
        }
    }

    const result = await upsertOrgBillingAccount({
        org_id: newOrgId,
        stripe_customer_id: customerId
    });

    if (result.isErr()) {
        return err(result.error);
    }

    // Resync subscriptions to ensure state reflects new org mapping
    try {
        const stripe = getStripeClient();
        const listResult = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100
        });

        for (const subscription of listResult.data) {
            const syncResult = await syncSubscriptionFromStripe(subscription as Stripe.Subscription);
            if (syncResult.isErr()) {
                return err(syncResult.error);
            }
        }
    } catch (e) {
        return err(
            billingError(
                "STRIPE_ERROR",
                `Failed to sync subscriptions for customer ${customerId}: ${
                    e instanceof Error ? e.message : String(e)
                }`,
                e
            )
        );
    }

    return ok({
        customerId,
        previousOrgId,
        newOrgId,
        changed: true
    });
}
