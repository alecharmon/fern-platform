import { PostHog } from "posthog-node";
import { createDomainLogger } from "../config/logger";

const log = createDomainLogger("posthog");

function getPosthogKey(): string | undefined {
    const key = process.env.POSTHOG_API_KEY;
    if (key == null || key.trim() === "") {
        return undefined;
    }
    return key.trim();
}

function getPosthog(): PostHog | undefined {
    const key = getPosthogKey();
    if (!key) {
        return undefined;
    }
    return new PostHog(key, {
        host: "https://us.i.posthog.com"
    });
}

export async function track(event: string, properties?: Record<string, unknown>) {
    try {
        const client = getPosthog();

        client?.capture({
            event,
            distinctId: "server-side-event",
            properties: {
                $process_person_profile: false,
                ...properties
            }
        });

        await client?.shutdown();
    } catch (error) {
        log.error("Error tracking event", { error: JSON.stringify(error) });
    }
}

export async function isPosthogFeatureFlagEnabled(flagKey: string, distinctId: string): Promise<boolean> {
    try {
        const client = getPosthog();
        if (!client) {
            return false;
        }

        const enabled = await client.isFeatureEnabled(flagKey, distinctId);
        await client.shutdown();
        return Boolean(enabled);
    } catch (error) {
        log.error("Error checking feature flag", { error: JSON.stringify(error), flagKey });
        return false;
    }
}
