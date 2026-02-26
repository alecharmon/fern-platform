/**
 * Stripe Client Service
 *
 * Wraps the Stripe SDK with checkout, portal, and customer management methods.
 * Uses the shared Stripe instance from @fern-platform/billing.
 */
import { getStripeClient as getBillingStripeClient, type Stripe } from "@fern-platform/billing";

export class StripeClient {
    private stripe: Stripe;

    constructor() {
        this.stripe = getBillingStripeClient();
    }

    /**
     * Get or create a Stripe customer by email
     */
    async getOrCreateCustomer(email: string, name: string, orgId: string): Promise<Stripe.Customer> {
        const existingCustomers = await this.stripe.customers.list({
            email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            return existingCustomers.data[0]!;
        }

        return this.stripe.customers.create({
            email,
            name,
            metadata: {
                orgId
            }
        });
    }

    /**
     * Get active subscriptions for a customer
     */
    async getActiveSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
        const subscriptions = await this.stripe.subscriptions.list({
            customer: customerId,
            status: "active",
            limit: 100
        });
        return subscriptions.data;
    }

    /**
     * Create a checkout session for subscription using Stripe price IDs directly.
     */
    async createCheckoutSessionWithPrices(
        customerId: string,
        priceIds: string[],
        successUrl: string,
        cancelUrl: string,
        metadata?: Record<string, string>,
        trialDays?: number
    ): Promise<Stripe.Checkout.Session> {
        return this.stripe.checkout.sessions.create({
            customer: customerId,
            line_items: priceIds.map((price) => ({ price, quantity: 1 })),
            mode: "subscription",
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true,
            metadata: metadata || {},
            ...(trialDays != null && {
                payment_method_collection: "if_required" as const,
                subscription_data: { trial_period_days: trialDays }
            })
        });
    }

    /**
     * Create a billing portal session
     */
    async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
        return this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl
        });
    }

    /**
     * Create a billing portal session for upgrading to a specific plan.
     * Uses subscription_update_confirm flow to skip plan selection.
     */
    async createUpgradePortalSession(
        customerId: string,
        subscriptionId: string,
        priceIds: string[],
        returnUrl: string
    ): Promise<Stripe.BillingPortal.Session> {
        const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
        const existingItems = subscription.items.data;

        const items: Stripe.BillingPortal.SessionCreateParams.FlowData.SubscriptionUpdateConfirm.Item[] = [];
        for (let i = 0; i < priceIds.length; i++) {
            if (i < existingItems.length) {
                items.push({
                    id: existingItems[i]!.id,
                    price: priceIds[i]
                });
            }
        }

        return this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,

            flow_data: {
                type: "subscription_update_confirm",
                subscription_update_confirm: {
                    subscription: subscriptionId,
                    items
                },
                after_completion: {
                    type: "redirect",
                    redirect: {
                        return_url: returnUrl
                    }
                }
            }
        });
    }

    /**
     * Create a billing portal subscription_update_confirm session for an existing addon seat item.
     * Caller is responsible for resolving the existing subscription item ID.
     */
    async createAddonSeatsPortalSession(
        customerId: string,
        subscriptionId: string,
        existingItemId: string,
        newTotalQuantity: number,
        returnUrl: string
    ): Promise<Stripe.BillingPortal.Session> {
        return this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
            flow_data: {
                type: "subscription_update_confirm",
                subscription_update_confirm: {
                    subscription: subscriptionId,
                    items: [{ id: existingItemId, quantity: newTotalQuantity }]
                },
                after_completion: {
                    type: "redirect",
                    redirect: { return_url: returnUrl }
                }
            }
        });
    }

    /**
     * Create a billing portal session for canceling a subscription.
     * Uses subscription_cancel flow to go directly to cancellation.
     */
    async createCancelPortalSession(
        customerId: string,
        subscriptionId: string,
        returnUrl: string
    ): Promise<Stripe.BillingPortal.Session> {
        return this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
            flow_data: {
                type: "subscription_cancel",
                subscription_cancel: {
                    subscription: subscriptionId
                },
                after_completion: {
                    type: "redirect",
                    redirect: {
                        return_url: returnUrl
                    }
                }
            }
        });
    }

    /**
     * Get subscription by ID
     */
    async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
        return this.stripe.subscriptions.retrieve(subscriptionId);
    }

    /**
     * Get customer by ID
     */
    async getCustomer(customerId: string): Promise<Stripe.Customer> {
        const customer = await this.stripe.customers.retrieve(customerId);
        if (customer.deleted) {
            throw new Error(`Customer ${customerId} has been deleted`);
        }
        return customer as Stripe.Customer;
    }

    /**
     * Get raw Stripe instance (for advanced usage)
     */
    getStripeInstance(): Stripe {
        return this.stripe;
    }
}

// Singleton instance
let stripeClientInstance: StripeClient | null = null;

export function getStripeClient(): StripeClient {
    if (!stripeClientInstance) {
        stripeClientInstance = new StripeClient();
    }
    return stripeClientInstance;
}
