/**
 * Stripe constants and utilities
 *
 * Re-exports from @fern-platform/billing for dashboard use.
 */

export {
    ACTIVE_STATUSES,
    isActiveStatus,
    type ProductTier,
    type SubscriptionStatus
} from "@fern-platform/billing";

/**
 * Pricing tiers for UI display.
 * Maps to ProductTier from the billing package.
 */
export const PRICING_TIER = {
    FREE: "free",
    PAID: "paid",
    ENTERPRISE: "enterprise"
} as const satisfies Record<string, ProductTier>;

import type { ProductTier } from "@fern-platform/billing";

export type PricingTier = ProductTier;
