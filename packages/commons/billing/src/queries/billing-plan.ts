import { err, ok, type Result } from "neverthrow";
import { getOrgActiveProducts } from "../db/products";
import { getActiveSubscription } from "../db/subscriptions";
import type { ProductTier } from "../db/types";
import { type BillingError, billingError } from "../errors";

/**
 * Billing plan information for an organization.
 */
export interface BillingPlan {
    orgId: string;
    tier: ProductTier;
    status: "active" | "trialing" | "past_due";
    products: Array<{
        sku: string;
        kind: "plan" | "addon";
        tier: ProductTier;
    }>;
    subscription: {
        id: string;
        stripeSubscriptionId: string;
        currentPeriodEnd: Date;
    };
}

/**
 * Derive the highest tier from a list of products.
 */
function deriveHighestTier(tiers: (string | null)[]): ProductTier {
    if (tiers.includes("enterprise")) {
        return "enterprise";
    }
    if (tiers.includes("paid")) {
        return "paid";
    }
    return "free";
}

/**
 * Get billing plan for an organization.
 * Returns null if the org has no active subscription.
 */
export async function getBillingPlan(orgId: string): Promise<Result<BillingPlan | null, BillingError>> {
    // Get active subscription
    const subscriptionResult = await getActiveSubscription(orgId);
    if (subscriptionResult.isErr()) {
        return err(subscriptionResult.error);
    }

    const subscription = subscriptionResult.value;
    if (!subscription) {
        return ok(null);
    }

    // Get active products from view
    const productsResult = await getOrgActiveProducts(orgId);
    if (productsResult.isErr()) {
        return err(productsResult.error);
    }

    const products = productsResult.value;
    if (products.length === 0) {
        return ok(null);
    }

    // Validate subscription has required fields
    if (!subscription.current_period_end) {
        return err(billingError("INVALID_STATE", `Subscription ${subscription.id} missing current_period_end`));
    }

    // Build plan response
    const plan: BillingPlan = {
        orgId,
        tier: deriveHighestTier(products.map((p) => p.tier)),
        status: subscription.status as "active" | "trialing" | "past_due",
        products: products
            .filter(
                (p): p is typeof p & { sku: string; kind: string; tier: string } =>
                    p.sku != null && p.kind != null && p.tier != null
            )
            .map((p) => ({
                sku: p.sku,
                kind: p.kind as "plan" | "addon",
                tier: p.tier as ProductTier
            })),
        subscription: {
            id: subscription.id,
            stripeSubscriptionId: subscription.stripe_subscription_id,
            currentPeriodEnd: new Date(subscription.current_period_end)
        }
    };

    return ok(plan);
}
