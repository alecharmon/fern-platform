import { getClient } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";

import { type BillingError, billingError } from "../errors";
import type { StripeEventInbox, StripeEventInboxInsert } from "./types";

/**
 * Try to insert an event. Returns false if event already exists (idempotency).
 */
export async function tryInsertEvent(event: StripeEventInboxInsert): Promise<Result<boolean, BillingError>> {
    try {
        const client = getClient();
        const { error } = await client.from("stripe_event_inbox").insert(event);

        if (error) {
            // Unique constraint violation means event already exists
            if (error.code === "23505") {
                return ok(false);
            }
            return err(billingError("QUERY_FAILED", `Failed to insert event: ${error.message}`, error));
        }

        return ok(true);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to insert event", e));
    }
}

/**
 * Mark an event as processed.
 */
export async function markEventProcessed(stripeEventId: string): Promise<Result<void, BillingError>> {
    try {
        const client = getClient();
        const { error } = await client
            .from("stripe_event_inbox")
            .update({ processed_at: new Date().toISOString() })
            .eq("stripe_event_id", stripeEventId);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to mark event processed: ${error.message}`, error));
        }

        return ok(undefined);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to mark event processed", e));
    }
}

/**
 * Mark an event as failed with error message.
 */
export async function markEventFailed(
    stripeEventId: string,
    errorMessage: string
): Promise<Result<void, BillingError>> {
    try {
        const client = getClient();
        const { error } = await client
            .from("stripe_event_inbox")
            .update({
                processed_at: new Date().toISOString(),
                processing_error: errorMessage
            })
            .eq("stripe_event_id", stripeEventId);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to mark event failed: ${error.message}`, error));
        }

        return ok(undefined);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to mark event failed", e));
    }
}

/**
 * Get an event by ID.
 */
export async function getEvent(stripeEventId: string): Promise<Result<StripeEventInbox | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("stripe_event_inbox")
            .select("*")
            .eq("stripe_event_id", stripeEventId)
            .maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get event: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get event", e));
    }
}

/**
 * Get unprocessed events (for retry/debugging).
 */
export async function getUnprocessedEvents(limit = 100): Promise<Result<StripeEventInbox[], BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("stripe_event_inbox")
            .select("*")
            .is("processed_at", null)
            .order("created_at", { ascending: true })
            .limit(limit);

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get unprocessed events: ${error.message}`, error));
        }

        return ok(data ?? []);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get unprocessed events", e));
    }
}
