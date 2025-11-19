import { PostHog } from "posthog-node";
import { createDomainLogger } from "../config/logger";

const log = createDomainLogger("posthog");

function getPosthogKey(): string | undefined {
    const key = process.env.POSTHOG_API_KEY;
    if (key == null) {
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
