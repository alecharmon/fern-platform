import { PostHog } from "posthog-node";
import { DOCS_SITE_PUBLISHED_EVENT, type DocsSitePublishedProperties } from "./events";

const POSTHOG_HOST = "https://us.i.posthog.com";

export interface PosthogService {
    captureDocsSitePublished(properties: DocsSitePublishedProperties): void;
    shutdown(): Promise<void>;
}

export class PosthogServiceImpl implements PosthogService {
    private client: PostHog;

    constructor(apiKey: string) {
        this.client = new PostHog(apiKey, { host: POSTHOG_HOST });
    }

    captureDocsSitePublished(properties: DocsSitePublishedProperties): void {
        try {
            this.client.capture({
                distinctId: properties.userId ?? properties.orgId,
                event: DOCS_SITE_PUBLISHED_EVENT,
                properties
            });
        } catch (e) {
            // biome-ignore lint/suspicious/noConsole: intentional error logging for non-critical PostHog failures
            console.error("[PosthogService] Failed to capture docs-site-published event", e);
        }
    }

    async shutdown(): Promise<void> {
        try {
            await this.client.shutdown();
        } catch (e) {
            // biome-ignore lint/suspicious/noConsole: intentional error logging for non-critical PostHog failures
            console.error("[PosthogService] Failed to shutdown PostHog client", e);
        }
    }
}

export class NoOpPosthogService implements PosthogService {
    captureDocsSitePublished(_properties: DocsSitePublishedProperties): void {
        return;
    }

    async shutdown(): Promise<void> {
        return;
    }
}

const POSTHOG_API_KEY_ENV_VAR = "POSTHOG_API_KEY";

export function createPosthogService(): PosthogService {
    const apiKey = process.env[POSTHOG_API_KEY_ENV_VAR];
    if (!apiKey) {
        // biome-ignore lint/suspicious/noConsole: intentional warning when PostHog API key is missing
        console.error("[PosthogService] POSTHOG_API_KEY is not set, PostHog events will not be captured");
        return new NoOpPosthogService();
    }
    try {
        return new PosthogServiceImpl(apiKey);
    } catch (e) {
        // biome-ignore lint/suspicious/noConsole: intentional error logging for non-critical PostHog failures
        console.error("[PosthogService] Failed to initialize PostHog client, events will not be captured", e);
        return new NoOpPosthogService();
    }
}
