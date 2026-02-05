import { constructWebhookEvent, processWebhookEvent } from "@fern-platform/billing";
import { type NextRequest, NextResponse } from "next/server";

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
