import { err, ok, type Result } from "neverthrow";
import { getActiveOverrides } from "../db/overrides";
import { getOrgActiveProducts, getProductBySku } from "../db/products";
import { hasAnySubscription } from "../db/subscriptions";
import type { ProductKind, ProductTier } from "../db/types";
import type { BillingError } from "../errors";

/**
 * Source of a billing product.
 */
export type BillingProductSource = "stripe" | "override";

/**
 * A product contributing to the billing plan.
 */
export interface BillingPlanProduct {
    sku: string;
    kind: "plan" | "addon";
    tier: ProductTier;
    status: string;
    qty: number;
    source: BillingProductSource;
    /** Only present when source is "override" */
    overrideId?: string;
}

/**
 * Billing plan information for an organization.
 */
export interface BillingPlan {
    orgId: string;
    tier: ProductTier;
    status: string;
    /** SKU of the first product with kind "plan", if one exists */
    planSku: string | null;
    products: BillingPlanProduct[];
    subscription: {
        id: string;
    } | null;
    /** Whether the org has ever had any subscription (regardless of status). */
    hasSubscriptionHistory: boolean;
    /** Whether any products come from manual overrides. */
    hasOverrides: boolean;
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
 * Merges Stripe-sourced products with manual overrides.
 * Returns null if the org has no active products or overrides.
 */
export async function getBillingPlan(orgId: string): Promise<Result<BillingPlan | null, BillingError>> {
    const [productsResult, overridesResult, hasSubResult] = await Promise.all([
        getOrgActiveProducts(orgId),
        getActiveOverrides(orgId),
        hasAnySubscription(orgId)
    ]);

    if (productsResult.isErr()) {
        return err(productsResult.error);
    }
    if (overridesResult.isErr()) {
        return err(overridesResult.error);
    }
    if (hasSubResult.isErr()) {
        return err(hasSubResult.error);
    }

    const stripeProducts = productsResult.value;
    const overrides = overridesResult.value;
    const hasSubscriptionHistory = hasSubResult.value;

    if (stripeProducts.length === 0 && overrides.length === 0) {
        return ok(null);
    }

    // Map Stripe products
    const validStripeProducts = stripeProducts.filter(
        (p): p is typeof p & { sku: string; kind: string; tier: string; status: string; qty: number | null } =>
            p.sku != null && p.kind != null && p.tier != null && p.status != null
    );

    const allProducts: BillingPlanProduct[] = validStripeProducts.map((p) => ({
        sku: p.sku,
        kind: p.kind as ProductKind,
        tier: p.tier as ProductTier,
        status: p.status,
        qty: p.qty ?? 1,
        source: "stripe" as const
    }));

    // Map overrides — look up SKU metadata from billing_product table
    for (const override of overrides) {
        const productResult = await getProductBySku(override.sku);
        const product = productResult.isOk() ? productResult.value : null;

        allProducts.push({
            sku: override.sku,
            kind: (product?.kind as ProductKind) ?? "plan",
            tier: (product?.tier as ProductTier) ?? "enterprise",
            status: "active",
            qty: 1,
            source: "override",
            overrideId: override.id
        });
    }

    const planProduct = allProducts.find((p) => p.kind === "plan");

    const plan: BillingPlan = {
        orgId,
        tier: deriveHighestTier(allProducts.map((p) => p.tier)),
        status: planProduct?.status ?? "unknown",
        planSku: planProduct?.sku ?? null,
        products: allProducts,
        subscription: stripeProducts[0]?.subscription_id ? { id: stripeProducts[0].subscription_id } : null,
        hasSubscriptionHistory,
        hasOverrides: overrides.length > 0
    };

    return ok(plan);
}
