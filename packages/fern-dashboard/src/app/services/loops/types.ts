/**
 * Contact properties sent to Loops when a user logs in or
 * when their subscription changes.
 *
 * Only the fields that are set will be sent — Loops merges
 * properties on update so sparse payloads are fine.
 */
export interface LoopsContactProperties {
    firstName?: string;
    lastName?: string;
    /** The user's Auth0 user ID */
    userId?: string;
    /** Current billing plan name (e.g. "free", "pro", "enterprise") */
    plan?: string;
    /** ISO-8601 date when the current billing period ends */
    planExpirationDate?: string;
    /** Stripe customer ID associated with the user's org */
    stripeCustomerId?: string;
    /** The org ID the user belongs to */
    orgId?: string;
    /** Stripe subscription status (e.g. "trialing", "active", "canceled", "past_due") */
    subscriptionStatus?: string;
    /** Additional custom properties */
    [key: string]: string | number | boolean | null | undefined;
}
