import { logger } from "@fern-api/ui-core-utils/logger";
import { PostHog } from "posthog-node";

function getPosthogKey(): string | undefined {
    const key = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
    if (key == null) {
        return undefined;
    }
    return key.trim();
}

// Singleton PostHog client to avoid creating a new client per event
let posthogClient: PostHog | undefined;

function getPosthog(): PostHog | undefined {
    if (posthogClient) {
        return posthogClient;
    }
    const key = getPosthogKey();
    if (!key) {
        return undefined;
    }
    posthogClient = new PostHog(key, {
        host: "https://us.i.posthog.com",
        flushAt: 20, // Flush every 20 events
        flushInterval: 10000 // Flush every 10 seconds
    });
    return posthogClient;
}

export function track(event: string, properties?: Record<string, unknown>) {
    try {
        const client = getPosthog();

        client?.capture({
            event,
            distinctId: "server-side-event",
            properties: {
                // anonymize this event because it's server-side https://posthog.com/docs/product-analytics/capture-events?tab=Backend
                $process_person_profile: false,
                ...properties
            }
        });
    } catch (error) {
        if (process.env.NODE_ENV !== "development") {
            logger.error(`[posthog] ${JSON.stringify(error)}`);
        }
    }
}

/**
 * Flush all pending PostHog events. Call this at the end of long-running requests
 * to ensure events are sent before the serverless function terminates.
 */
export async function flushPosthog(): Promise<void> {
    try {
        await posthogClient?.flush();
    } catch (error) {
        if (process.env.NODE_ENV !== "development") {
            logger.error(`[posthog] flush error: ${JSON.stringify(error)}`);
        }
    }
}

/**
 * Check if a PostHog feature flag is enabled for the given distinctId.
 */
export async function isPosthogFeatureFlagEnabled(flagKey: string, distinctId: string): Promise<boolean> {
    try {
        const client = getPosthog();
        if (!client) {
            return false;
        }

        const enabled = await client.isFeatureEnabled(flagKey, distinctId);
        return Boolean(enabled);
    } catch (error) {
        if (process.env.NODE_ENV !== "development") {
            logger.error(`[posthog] feature flag error: ${JSON.stringify(error)}`);
        }
        return false;
    }
}
