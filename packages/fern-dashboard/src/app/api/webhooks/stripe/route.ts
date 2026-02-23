import { constructWebhookEvent, getStripeClient, processWebhookEvent } from "@fern-platform/billing";
import { type NextRequest, NextResponse } from "next/server";

import { getLoopsService } from "@/app/services/loops";

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
 * Fire-and-forget: update Loops contact with the latest plan details
 * after a subscription webhook has been successfully processed.
 */
async function syncLoopsContactAfterSubscriptionChange(details: Record<string, unknown>): Promise<void> {
    const customerId = details.customerId as string | undefined;
    if (!customerId) {
        return;
    }

    const email = await resolveCustomerEmail(customerId);
    if (!email) {
        return;
    }

    await getLoopsService().upsertContact(email, {
        plan: (details.plan as string) ?? undefined,
        planExpirationDate: (details.currentPeriodEnd as string) ?? undefined,
        orgId: (details.orgId as string) ?? undefined,
        stripeCustomerId: customerId
    });
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
