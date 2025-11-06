import type { PostHog } from "posthog-js";

/**
 * Centralized PostHog event names for type safety and consistency.
 * Similar to feature flags pattern, this ensures we don't use magic strings.
 */
export const PosthogEventName = {
    DOCS_TAB_VIEWED: "dashboard-docs-tab-viewed",
    REPO_CONNECTED: "dashboard-repo-connected"
} as const;

export type PosthogEventName = (typeof PosthogEventName)[keyof typeof PosthogEventName];

/**
 * Type map for event payloads. Each event name maps to its required properties.
 * This ensures type safety when capturing events.
 */
export type PosthogEventPayloads = {
    [PosthogEventName.DOCS_TAB_VIEWED]: {
        tab: string;
        siteHasGitHubAppInstalled: boolean;
        siteHasConnectedRepo: boolean;
    };
    [PosthogEventName.REPO_CONNECTED]: {
        siteHasGitHubAppInstalled: boolean;
        siteHasConnectedRepo: boolean;
    };
};

/**
 * Type-safe event capture helper.
 * Ensures the event name and payload match the defined types.
 *
 * @param posthog - PostHog instance (can be null if tracking is disabled)
 * @param name - Event name from PosthogEventName
 * @param properties - Event properties matching the event's payload type
 */
export function captureEvent<Name extends PosthogEventName>(
    posthog: PostHog | null,
    name: Name,
    properties: PosthogEventPayloads[Name]
): void {
    posthog?.capture(name, properties);
}

/**
 * Convenience helper for capturing docs tab viewed events.
 * Provides a more discoverable API for this specific event.
 *
 * @param posthog - PostHog instance (can be null if tracking is disabled)
 * @param properties - Tab view event properties
 */
export function captureDocsTabViewed(
    posthog: PostHog | null,
    properties: PosthogEventPayloads[typeof PosthogEventName.DOCS_TAB_VIEWED]
): void {
    captureEvent(posthog, PosthogEventName.DOCS_TAB_VIEWED, properties);
}

/**
 * Convenience helper for capturing repo connected events.
 * Provides a more discoverable API for this specific event.
 *
 * @param posthog - PostHog instance (can be null if tracking is disabled)
 * @param properties - Repo connected event properties
 */
export function captureRepoConnected(
    posthog: PostHog | null,
    properties: PosthogEventPayloads[typeof PosthogEventName.REPO_CONNECTED]
): void {
    captureEvent(posthog, PosthogEventName.REPO_CONNECTED, properties);
}
