import type { Stripe } from "stripe";
import { getAddonSeatsPriceId, getAllAddonSeatsPriceIds } from "./stripe_pricing_config";

export interface SubscriptionAddonContext {
    /** Billing interval derived from the base plan: "month" or "year" */
    billingInterval: "month" | "year";
    /** The addon seats Stripe price ID matching the billing interval */
    targetAddonPriceId: string;
    /** The existing addon seats subscription item, if any */
    existingItem: Stripe.SubscriptionItem | undefined;
    /** Current addon seat quantity (0 if no addon item exists) */
    existingQuantity: number;
}

/**
 * Inspect a Stripe subscription to determine the billing interval,
 * the correct addon seats price ID, and any existing addon item.
 */
export function resolveSubscriptionAddonContext(stripeSub: Stripe.Subscription): SubscriptionAddonContext {
    const addonSeatsPriceIds = getAllAddonSeatsPriceIds();
    const basePlanItem = stripeSub.items.data.find((item) => !addonSeatsPriceIds.includes(item.price.id));
    const billingInterval: "month" | "year" = basePlanItem?.price.recurring?.interval === "year" ? "year" : "month";
    const targetAddonPriceId = getAddonSeatsPriceId(billingInterval);
    const existingItem = stripeSub.items.data.find((item) => addonSeatsPriceIds.includes(item.price.id));

    return {
        billingInterval,
        targetAddonPriceId,
        existingItem,
        existingQuantity: existingItem?.quantity ?? 0
    };
}
