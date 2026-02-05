import type Stripe from "stripe";

// Minimal Json type compatible with Supabase generated types
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

import { err, ok, type Result } from "neverthrow";

import { markEventFailed, markEventProcessed, tryInsertEvent } from "../db/events";
import { type BillingError, billingError } from "../errors";

export interface IdempotencyResult {
    processed: boolean;
    skipped: boolean;
    eventId: string;
}

/**
 * Execute a handler with idempotency guarantees.
 * - Inserts event into inbox (fails silently if duplicate)
 * - Runs handler if event is new
 * - Marks event as processed or failed
 */
export async function withIdempotency(
    event: Stripe.Event,
    handler: () => Promise<void>
): Promise<Result<IdempotencyResult, BillingError>> {
    const eventId = event.id;

    const insertResult = await tryInsertEvent({
        stripe_event_id: eventId,
        type: event.type,
        created_at: new Date(event.created * 1000).toISOString(),
        // Stripe events are JSON-serializable; cast to Supabase Json type
        payload: event as unknown as Json
    });

    if (insertResult.isErr()) {
        return err(insertResult.error);
    }

    if (!insertResult.value) {
        return ok({ processed: false, skipped: true, eventId });
    }

    try {
        await handler();
        const markResult = await markEventProcessed(eventId);
        if (markResult.isErr()) {
        }

        return ok({ processed: true, skipped: false, eventId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const markResult = await markEventFailed(eventId, message);
        if (markResult.isErr()) {
        }

        return err(billingError("STRIPE_ERROR", `Failed to process event ${eventId}: ${message}`, error));
    }
}
