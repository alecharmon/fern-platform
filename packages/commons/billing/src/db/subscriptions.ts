import { getClient } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";

import { type BillingError, billingError } from "../errors";
import type {
    OrgSubscription,
    OrgSubscriptionInsert,
    OrgSubscriptionItem,
    OrgSubscriptionItemInsert,
    OrgSubscriptionUpdate
} from "./types";

/**
 * Get active subscription for an org (status in active, trialing, past_due).
 */
export async function getActiveSubscription(orgId: string): Promise<Result<OrgSubscription | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_subscription")
            .select("*")
            .eq("org_id", orgId)
            .in("status", ["active", "trialing", "past_due"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get subscription: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get subscription", e));
    }
}

/**
 * Get subscription by Stripe subscription ID.
 */
export async function getSubscriptionByStripeId(
    stripeSubscriptionId: string
): Promise<Result<OrgSubscription | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_subscription")
            .select("*")
            .eq("stripe_subscription_id", stripeSubscriptionId)
            .maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get subscription: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get subscription", e));
    }
}

/**
 * Create a new subscription.
 */
export async function createSubscription(
    subscription: OrgSubscriptionInsert
): Promise<Result<OrgSubscription, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client.from("org_subscription").insert(subscription).select().single();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to create subscription: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to create subscription", e));
    }
}

/**
 * Update a subscription.
 */
export async function updateSubscription(
    subscriptionId: string,
    update: OrgSubscriptionUpdate
): Promise<Result<OrgSubscription, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_subscription")
            .update({ ...update, updated_at: new Date().toISOString() })
            .eq("id", subscriptionId)
            .select()
            .single();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to update subscription: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to update subscription", e));
    }
}

/**
 * Upsert subscription by Stripe ID.
 */
export async function upsertSubscriptionByStripeId(
    subscription: OrgSubscriptionInsert
): Promise<Result<OrgSubscription, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_subscription")
            .upsert({ ...subscription, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" })
            .select()
            .single();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to upsert subscription: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to upsert subscription", e));
    }
}

/**
 * Get subscription items for a subscription.
 */
export async function getSubscriptionItems(
    subscriptionId: string
): Promise<Result<OrgSubscriptionItem[], BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_subscription_item")
            .select("*")
            .eq("org_subscription_id", subscriptionId);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get subscription items: ${error.message}`, error));
        }

        return ok(data ?? []);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get subscription items", e));
    }
}

/**
 * Upsert subscription item by Stripe item ID.
 */
export async function upsertSubscriptionItem(
    item: OrgSubscriptionItemInsert
): Promise<Result<OrgSubscriptionItem, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_subscription_item")
            .upsert({ ...item, updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_item_id" })
            .select()
            .single();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to upsert subscription item: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to upsert subscription item", e));
    }
}

/**
 * Delete subscription items not in the given list of Stripe item IDs.
 */
export async function deleteSubscriptionItemsNotIn(
    subscriptionId: string,
    keepStripeItemIds: string[]
): Promise<Result<void, BillingError>> {
    try {
        const client = getClient();

        let query = client.from("org_subscription_item").delete().eq("org_subscription_id", subscriptionId);

        if (keepStripeItemIds.length > 0) {
            query = query.not("stripe_subscription_item_id", "in", `(${keepStripeItemIds.join(",")})`);
        }

        const { error } = await query;

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to delete subscription items: ${error.message}`, error));
        }

        return ok(undefined);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to delete subscription items", e));
    }
}
