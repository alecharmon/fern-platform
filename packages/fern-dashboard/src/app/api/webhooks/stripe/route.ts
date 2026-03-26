import { postToSlackImmediate } from "@fern-api/docs-server/slack";
import { constructWebhookEvent, getStripeClient, processWebhookEvent } from "@fern-platform/billing";
import { type NextRequest, NextResponse } from "next/server";
import { resolveOrgName } from "@/app/services/auth0/resolve-org-name";
import { getLoopsService } from "@/app/services/loops";
import { getServerSidePosthog } from "@/components/posthog/getServerSidePosthog";
import { ServerPosthogService } from "@/components/posthog/ServerPosthogService";

/**
 * Resolve a Stripe customer email.
 * The webhook `customer` field can be a string ID or an expanded Customer object.
 */
async function resolveCustomerEmail(customerId: string): Promise<string | undefined> {
    try {
        const stripe = getStripeClient();
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
            return undefined;
        }
        return customer.email ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * Check whether a Stripe customer has at least one payment method on file.
 */
async function customerHasPaymentMethod(customerId: string): Promise<boolean> {
    try {
        const stripe = getStripeClient();
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            limit: 1
        });
        return paymentMethods.data.length > 0;
    } catch {
        return false;
    }
}

/**
 * Fire-and-forget: update Loops contact with the latest plan details
 * after a subscription webhook has been successfully processed.
 */
async function syncLoopsContactAfterSubscriptionChange(details: Record<string, unknown>): Promise<void> {
    const customerId = details.customerId as string | undefined;
    if (!customerId) {
        return;
    }

    const [email, hasPaymentMethod] = await Promise.all([
        resolveCustomerEmail(customerId),
        customerHasPaymentMethod(customerId)
    ]);
    if (!email) {
        return;
    }

    await getLoopsService().upsertContact(email, {
        plan: (details.plan as string) ?? undefined,
        planExpirationDate: (details.currentPeriodEnd as string) ?? undefined,
        orgId: (details.orgId as string) ?? undefined,
        stripeCustomerId: customerId,
        subscriptionStatus: (details.subscriptionStatus as string) ?? undefined,
        hasPaymentMethod
    });
}

/**
 * Fire-and-forget: send a Slack notification to #dashboard-billing-notifs
 * when a billing-related event is processed.
 */
async function notifySlackBillingEvent(action: string | undefined, details: Record<string, unknown>): Promise<void> {
    if (!action) {
        return;
    }

    const orgId = details.orgId as string | undefined;
    const plan = details.plan as string | undefined;
    const subscriptionStatus = details.subscriptionStatus as string | undefined;

    let emoji: string;
    let description: string;

    switch (action) {
        case "subscription_created":
            emoji = ":tada:";
            description = "New subscription created";
            break;
        case "subscription_updated":
            emoji = ":arrows_counterclockwise:";
            description = "Subscription updated";
            break;
        case "subscription_deleted":
            emoji = ":wave:";
            description = "Subscription canceled";
            break;
        case "invoice_payment_logged": {
            const invoiceId = details.invoiceId as string | undefined;
            const amountPaid = details.amountPaid as number | undefined;
            const currency = (details.currency as string | undefined) ?? "usd";
            const invoiceOrgId = details.orgId as string | undefined;

            const invoiceOrgName = invoiceOrgId ? await resolveOrgName(invoiceOrgId) : undefined;

            const invoiceParts = [`:money_with_wings: *Invoice payment succeeded*`];
            if (invoiceOrgName) {
                invoiceParts.push(`Org: *${invoiceOrgName}*`);
            }
            if (amountPaid != null) {
                const formatted = new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: currency.toUpperCase()
                }).format(amountPaid / 100);
                invoiceParts.push(`Amount: *${formatted}*`);
            }
            invoiceParts.push(`Invoice: \`${invoiceId ?? "unknown"}\``);

            await postToSlackImmediate("#dashboard-billing-notifs", invoiceParts.join(" | "), "billing");
            return;
        }
        default:
            return;
    }

    const orgName = orgId ? await resolveOrgName(orgId) : undefined;

    const parts = [`${emoji} *${description}*`];
    if (orgName) {
        parts.push(`Org: *${orgName}*`);
    }
    if (plan) {
        parts.push(`Plan: *${plan}*`);
    }
    if (subscriptionStatus) {
        parts.push(`Status: \`${subscriptionStatus}\``);
    }

    await postToSlackImmediate("#dashboard-billing-notifs", parts.join(" | "), "billing");
}

/**
 * Fire-and-forget: capture PostHog funnel events when subscriptions are created or activated.
 * Uses ServerPosthogService which resolves orgName internally via Auth0.
 */
async function captureSubscriptionPosthogEvent(
    action: string | undefined,
    details: Record<string, unknown>
): Promise<void> {
    if (!action) {
        return;
    }

    const orgId = details.orgId as string | undefined;
    if (!orgId) {
        return;
    }

    const posthogService = new ServerPosthogService(getServerSidePosthog());
    const subscriptionId = details.subscriptionId as string | undefined;
    const plan = details.plan as string | undefined;
    const subscriptionStatus = details.subscriptionStatus as string | undefined;

    if (action === "subscription_created" && subscriptionStatus === "trialing") {
        await posthogService.captureTrialStarted({
            orgId,
            plan: plan ?? undefined,
            subscriptionId: subscriptionId ?? undefined
        });
    }

    if ((action === "subscription_created" || action === "subscription_updated") && subscriptionStatus === "active") {
        await posthogService.captureSubscriptionActivated({
            orgId,
            plan: plan ?? undefined,
            subscriptionId: subscriptionId ?? undefined
        });
    }
}

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint for receiving subscription events.
 * Verifies webhook signature and processes events idempotently.
 */
export async function POST(request: NextRequest) {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
        console.error("[stripe-webhook] Missing stripe-signature header");
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const eventResult = constructWebhookEvent(payload, signature);

    if (eventResult.isErr()) {
        console.error("[stripe-webhook] Signature verification failed:", eventResult.error);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = eventResult.value;
    console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

    const processResult = await processWebhookEvent(event);

    if (processResult.isErr()) {
        console.error(`[stripe-webhook] Failed to process event ${event.id}:`, processResult.error);
        return NextResponse.json(
            {
                received: true,
                processed: false,
                error: processResult.error.message
            },
            { status: 200 }
        );
    }

    const result = processResult.value;
    console.log(`[stripe-webhook] Event ${event.id} processed:`, {
        skipped: result.idempotency.skipped,
        handler: result.handler?.action
    });

    // Fire-and-forget: sync Loops contact when a subscription changes
    if (result.handler?.handled && result.handler.details) {
        const action = result.handler.action;
        if (
            action === "subscription_created" ||
            action === "subscription_updated" ||
            action === "subscription_deleted"
        ) {
            syncLoopsContactAfterSubscriptionChange(result.handler.details).catch(() => {
                /* already logged inside the service */
            });
        }
    }

    // Fire-and-forget: send Slack notification for billing events
    if (result.handler?.handled && result.handler.details) {
        notifySlackBillingEvent(result.handler.action, result.handler.details).catch((e) => {
            console.error("[stripe-webhook] Slack notification failed:", e);
        });
    }

    // Fire-and-forget: capture PostHog funnel events for subscription lifecycle
    if (result.handler?.handled && result.handler.details) {
        captureSubscriptionPosthogEvent(result.handler.action, result.handler.details).catch((e) => {
            console.error("[stripe-webhook] PostHog capture failed:", e);
        });
    }

    return NextResponse.json(
        {
            received: true,
            processed: result.idempotency.processed,
            skipped: result.idempotency.skipped,
            action: result.handler?.action
        },
        { status: 200 }
    );
}
