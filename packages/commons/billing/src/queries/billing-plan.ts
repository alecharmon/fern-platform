import { err, ok, type Result } from "neverthrow";
import { getOrgActiveProducts } from "../db/products";
import { hasAnySubscription } from "../db/subscriptions";
import type { ProductTier } from "../db/types";
import type { BillingError } from "../errors";

/**
 * Billing plan information for an organization.
 */
export interface BillingPlan {
    orgId: string;
    tier: ProductTier;
    status: string;
    /** SKU of the first product with kind "plan", if one exists */
    planSku: string | null;
    products: Array<{
        sku: string;
        kind: "plan" | "addon";
        tier: ProductTier;
        status: string;
        qty: number;
    }>;
    subscription: {
        id: string;
    } | null;
    /** Whether the org has ever had any subscription (regardless of status). */
    hasSubscriptionHistory: boolean;
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
 * Returns null if the org has no active products.
 */
export async function getBillingPlan(orgId: string): Promise<Result<BillingPlan | null, BillingError>> {
    const productsResult = await getOrgActiveProducts(orgId);

    if (productsResult.isErr()) {
        return err(productsResult.error);
    }

    const products = productsResult.value;

    const hasSubResult = await hasAnySubscription(orgId);
    if (hasSubResult.isErr()) {
        return err(hasSubResult.error);
    }
    const hasSubscriptionHistory = hasSubResult.value;

    if (products.length === 0) {
        return ok(null);
    }

    const validProducts = products.filter(
        (p): p is typeof p & { sku: string; kind: string; tier: string; status: string; qty: number | null } =>
            p.sku != null && p.kind != null && p.tier != null && p.status != null
    );

    const planProduct = validProducts.find((p) => p.kind === "plan");

    const plan: BillingPlan = {
        orgId,
        tier: deriveHighestTier(products.map((p) => p.tier)),
        status: planProduct?.status ?? "unknown",
        planSku: planProduct?.sku ?? null,
        products: validProducts.map((p) => ({
            sku: p.sku,
            kind: p.kind as "plan" | "addon",
            tier: p.tier as ProductTier,
            status: p.status,
            qty: p.qty ?? 1
        })),
        subscription: products[0]?.subscription_id ? { id: products[0].subscription_id } : null,
        hasSubscriptionHistory
    };

    return ok(plan);
}
