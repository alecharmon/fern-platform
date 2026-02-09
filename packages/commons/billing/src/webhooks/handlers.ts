import { err, ok, type Result } from "neverthrow";
import type Stripe from "stripe";

import { type BillingError, billingError } from "../errors";
import { syncCustomerFromStripe, syncCustomerUpdateFromStripe, syncSubscriptionFromStripe } from "./sync";

function resolveOrgId(customer: Stripe.Customer): string | undefined {
    return customer.metadata?.org_id ?? customer.metadata?.orgId;
}

export type WebhookHandlerResult = {
    handled: boolean;
    action?: string;
    details?: Record<string, unknown>;
};

async function handleCustomerCreated(customer: Stripe.Customer): Promise<Result<WebhookHandlerResult, BillingError>> {
    const orgId = resolveOrgId(customer);
    if (!orgId) {
        return err(billingError("INVALID_STATE", `Stripe customer ${customer.id} has no org_id in metadata`));
    }

    const result = await syncCustomerFromStripe(customer, orgId);
    if (result.isErr()) {
        return err(result.error);
    }

    return ok({
        handled: true,
        action: "customer_created",
        details: { orgId: result.value.orgId }
    });
}

async function handleCustomerUpdated(customer: Stripe.Customer): Promise<Result<WebhookHandlerResult, BillingError>> {
    const orgId = resolveOrgId(customer);
    if (!orgId) {
        return err(billingError("INVALID_STATE", `Stripe customer ${customer.id} has no org_id in metadata`));
    }

    const result = await syncCustomerUpdateFromStripe(customer, orgId);
    if (result.isErr()) {
        return err(result.error);
    }

    return ok({
        handled: true,
        action: result.value.changed ? "customer_org_changed" : "customer_updated_no_change",
        details: {
            customerId: result.value.customerId,
            previousOrgId: result.value.previousOrgId,
            newOrgId: result.value.newOrgId,
            changed: result.value.changed
        }
    });
}

async function handleSubscriptionCreated(
    subscription: Stripe.Subscription
): Promise<Result<WebhookHandlerResult, BillingError>> {
    const result = await syncSubscriptionFromStripe(subscription);
    if (result.isErr()) {
        return err(result.error);
    }

    return ok({
        handled: true,
        action: "subscription_created",
        details: {
            orgId: result.value.orgId,
            subscriptionId: result.value.subscriptionId,
            itemCount: result.value.itemCount
        }
    });
}

async function handleSubscriptionUpdated(
    subscription: Stripe.Subscription
): Promise<Result<WebhookHandlerResult, BillingError>> {
    const result = await syncSubscriptionFromStripe(subscription);
    if (result.isErr()) {
        return err(result.error);
    }

    return ok({
        handled: true,
        action: "subscription_updated",
        details: {
            orgId: result.value.orgId,
            subscriptionId: result.value.subscriptionId,
            itemCount: result.value.itemCount,
            status: subscription.status
        }
    });
}

async function handleSubscriptionDeleted(
    subscription: Stripe.Subscription
): Promise<Result<WebhookHandlerResult, BillingError>> {
    const result = await syncSubscriptionFromStripe(subscription);
    if (result.isErr()) {
        return err(result.error);
    }

    return ok({
        handled: true,
        action: "subscription_deleted",
        details: {
            orgId: result.value.orgId,
            subscriptionId: result.value.subscriptionId
        }
    });
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<Result<WebhookHandlerResult, BillingError>> {
    switch (event.type) {
        case "customer.created":
            return handleCustomerCreated(event.data.object as Stripe.Customer);

        case "customer.updated":
            return handleCustomerUpdated(event.data.object as Stripe.Customer);

        case "customer.subscription.created":
            return handleSubscriptionCreated(event.data.object as Stripe.Subscription);

        case "customer.subscription.updated":
            return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);

        case "customer.subscription.deleted":
            return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);

        case "invoice.payment_succeeded":
            return ok({
                handled: true,
                action: "invoice_payment_logged",
                details: { invoiceId: (event.data.object as Stripe.Invoice).id }
            });

        default:
            return ok({ handled: false, action: "unhandled_event_type", details: { type: event.type } });
    }
}
