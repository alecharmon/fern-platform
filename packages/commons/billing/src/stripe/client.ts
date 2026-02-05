import { err, ok, type Result } from "neverthrow";
import Stripe from "stripe";

import { type BillingError, billingError } from "../errors";

// Internal singleton
let stripeClient: Stripe | undefined;

/**
 * Get singleton Stripe client.
 * Requires STRIPE_SECRET_KEY environment variable.
 */
export function getStripeClient(): Stripe {
    if (stripeClient != null) {
        return stripeClient;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY environment variable.");
    }

    stripeClient = new Stripe(secretKey);

    return stripeClient;
}

/**
 * Get Stripe client as Result.
 */
export function getStripeClientResult(): Result<Stripe, BillingError> {
    try {
        return ok(getStripeClient());
    } catch (e) {
        return err(
            billingError(
                "NOT_CONFIGURED",
                "Could not initialize Stripe client: " + (e instanceof Error ? e.message : String(e)),
                e
            )
        );
    }
}

/**
 * Reset singleton (for testing).
 * @internal
 */
export function resetStripeClient(): void {
    stripeClient = undefined;
}

/**
 * Verify webhook signature and construct event.
 */
export function constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret?: string
): Result<Stripe.Event, BillingError> {
    try {
        const secret = webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
            return err(
                billingError("NOT_CONFIGURED", "Failed to verify webhook signature: STRIPE_WEBHOOK_SECRET not set")
            );
        }

        const stripe = getStripeClient();
        const event = stripe.webhooks.constructEvent(payload, signature, secret);
        return ok(event);
    } catch (e) {
        return err(
            billingError(
                "STRIPE_ERROR",
                "Failed to verify webhook signature: " + (e instanceof Error ? e.message : String(e)),
                e
            )
        );
    }
}
