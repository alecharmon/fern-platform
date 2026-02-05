import { err, ok, type Result } from "neverthrow";
import type Stripe from "stripe";

import type { BillingError } from "../errors";
import { handleWebhookEvent, type WebhookHandlerResult } from "./handlers";
import { type IdempotencyResult, withIdempotency } from "./idempotency";

export interface ProcessEventResult {
    eventId: string;
    eventType: string;
    idempotency: IdempotencyResult;
    handler?: WebhookHandlerResult;
}

/**
 * Process a Stripe webhook event with idempotency.
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<Result<ProcessEventResult, BillingError>> {
    let handlerResult: WebhookHandlerResult | undefined;

    const idempotencyResult = await withIdempotency(event, async () => {
        const result = await handleWebhookEvent(event);
        if (result.isErr()) {
            throw new Error(result.error.message);
        }
        handlerResult = result.value;
    });

    if (idempotencyResult.isErr()) {
        return err(idempotencyResult.error);
    }

    return ok({
        eventId: event.id,
        eventType: event.type,
        idempotency: idempotencyResult.value,
        handler: handlerResult
    });
}
