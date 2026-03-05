import { TRACK_EVENT_NAME } from "./constants";

const FEEDBACK_EVENTS = new Set([
    "feedback_voted",
    "feedback_submitted",
    "code_block_feedback_submitted",
    "code_block_feedback_opened"
]);

const SELF_HOSTED_FEEDBACK_LOG_PREFIX = "[fern-docs-feedback]";

function isSelfHosted(): boolean {
    return process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1";
}

/**
 * In self-hosted mode, emit structured console logs for feedback events
 * so that customers can filter their application logs to extract user feedback.
 */
function logFeedbackEvent(event: string, properties?: Record<string, unknown>): void {
    if (!isSelfHosted() || !FEEDBACK_EVENTS.has(event)) {
        return;
    }

    const payload = {
        event,
        timestamp: new Date().toISOString(),
        ...(properties != null ? { properties } : {})
    };

    console.info(`${SELF_HOSTED_FEEDBACK_LOG_PREFIX} ${JSON.stringify(payload)}`);
}

/**
 * Track an event.
 *
 * @param event - The event name.
 * @param properties - The event properties.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
    if (typeof window === "undefined") {
        return;
    }

    logFeedbackEvent(event, properties);
    window.dispatchEvent(new CustomEvent(TRACK_EVENT_NAME, { detail: { event, properties } }));
}

/**
 * Track an event that is only for internal use.
 *
 * @param event - The event name.
 * @param properties - The event properties.
 */
export function trackInternal(event: string, properties?: Record<string, unknown>): void {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(
        new CustomEvent(TRACK_EVENT_NAME, {
            detail: { event, properties, internal: true }
        })
    );
}
