/**
 * Stripe price IDs, resolved based on whether STRIPE_SECRET_KEY is a test key.
 */

function isTestMode(): boolean {
    return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ?? false;
}

interface PriceIds {
    /** Team plan monthly subscription */
    PRO_MONTHLY: string;
    /** Team plan yearly subscription */
    PRO_YEARLY: string;
    /** Super user pricing */
    SUPER_USER: string;
    /** Per-seat addon (monthly) */
    ADDON_EXTRA_SEATS: string;
    /** Per-seat addon (yearly) */
    ADDON_EXTRA_SEATS_YEARLY: string;
    /** Free trial enablement */
    FREE_TRIAL: boolean;
}

const LIVE_PRICE_IDS: PriceIds = {
    PRO_MONTHLY: "price_1SxVS3FYKJHzTJV9tzJ6f5c0",
    PRO_YEARLY: "price_1SxVS3FYKJHzTJV9j6eSH7GZ",
    SUPER_USER: "price_1SxYXdFYKJHzTJV9khP7EqTH",
    ADDON_EXTRA_SEATS: "price_1T1V0KFYKJHzTJV9eWh7uGdj",
    ADDON_EXTRA_SEATS_YEARLY: "price_1T5AmEFYKJHzTJV9gVrwP4By",
    FREE_TRIAL: true
};

const TEST_PRICE_IDS: PriceIds = {
    PRO_MONTHLY: "price_1T58u1FYKJHzTJV98TXaSZAj",
    PRO_YEARLY: "price_1T58u1FYKJHzTJV9ocXjP8ex",
    SUPER_USER: "price_1T58u1FYKJHzTJV9ocXjP8ex",
    ADDON_EXTRA_SEATS: "price_1T58uVFYKJHzTJV9C2Wju9ia",
    ADDON_EXTRA_SEATS_YEARLY: "price_1T5AkzFYKJHzTJV9CePIGzCD",
    FREE_TRIAL: false
};

/**
 * Returns the appropriate Stripe price IDs based on whether the
 * STRIPE_SECRET_KEY environment variable is a test key (`sk_test_*`).
 */
export function getPriceIds(): PriceIds {
    return isTestMode() ? TEST_PRICE_IDS : LIVE_PRICE_IDS;
}

/**
 * Resolve the Stripe price IDs to use for a Team plan checkout/upgrade.
 */
export function getCheckoutPriceIds(billingCycle: "monthly" | "yearly", useSuperUserPricing?: boolean): string[] {
    const prices = getPriceIds();
    if (useSuperUserPricing) {
        return [prices.SUPER_USER];
    }
    return billingCycle === "monthly" ? [prices.PRO_MONTHLY] : [prices.PRO_YEARLY];
}

/**
 * Returns the addon seats price ID for the given billing interval.
 */
export function getAddonSeatsPriceId(billingInterval: "month" | "year"): string {
    const prices = getPriceIds();
    return billingInterval === "year" ? prices.ADDON_EXTRA_SEATS_YEARLY : prices.ADDON_EXTRA_SEATS;
}

/**
 * Returns all addon seats price IDs (both monthly and yearly).
 */
export function getAllAddonSeatsPriceIds(): string[] {
    const prices = getPriceIds();
    return [prices.ADDON_EXTRA_SEATS, prices.ADDON_EXTRA_SEATS_YEARLY];
}

/**
 * Whether free trials are enabled for the current Stripe environment.
 */
export function isTrialEnabled(): boolean {
    return getPriceIds().FREE_TRIAL;
}

export type { PriceIds };
