import { getLoopsClient } from "./client";
import type { LoopsContactProperties } from "./types";

/**
 * Wrapper around the Loops SDK that silently no-ops when the
 * LOOPS_API_KEY environment variable is not configured.
 *
 * All public methods are safe to call regardless of whether Loops
 * is enabled — they will log a debug message and return early.
 */
export class LoopsService {
    /**
     * Create or update a contact in Loops.
     *
     * Uses `updateContact` under the hood so the call is an upsert:
     * if the contact already exists it is updated, otherwise it is created.
     */
    async upsertContact(email: string, properties?: LoopsContactProperties): Promise<void> {
        const client = getLoopsClient();
        if (!client) {
            return;
        }

        try {
            await client.updateContact({
                email,
                properties: properties as Record<string, string | number | boolean | null>
            });
            console.debug(`[loops] Upserted contact ${email}`);
        } catch (error) {
            // Fire-and-forget — never let Loops errors break app flows
            console.error("[loops] Failed to upsert contact:", error);
        }
    }

    /**
     * Send an event for a contact.
     *
     * Events can trigger automated Loops workflows (e.g. onboarding
     * sequences, plan-change notifications).
     */
    async sendEvent(
        email: string,
        eventName: string,
        properties?: Record<string, string | number | boolean>
    ): Promise<void> {
        const client = getLoopsClient();
        if (!client) {
            return;
        }

        try {
            await client.sendEvent({
                email,
                eventName,
                eventProperties: properties
            });
            console.debug(`[loops] Sent event "${eventName}" for ${email}`);
        } catch (error) {
            console.error(`[loops] Failed to send event "${eventName}":`, error);
        }
    }
}

/** Singleton instance */
let _service: LoopsService | undefined;

export function getLoopsService(): LoopsService {
    if (!_service) {
        _service = new LoopsService();
    }
    return _service;
}
