import { TRACK_EVENT_NAME } from "./constants";

const FEEDBACK_EVENTS = new Set([
    "feedback_voted",
    "feedback_submitted",
    "code_block_feedback_submitted",
    "code_block_feedback_opened"
]);

function isSelfHosted(): boolean {
    return process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1";
}

/**
 * In self-hosted mode, send feedback events to the server-side API route
 * so that they appear in Docker container stdout (via the logger).
 */
function logFeedbackEvent(event: string, properties?: Record<string, unknown>): void {
    if (!isSelfHosted() || !FEEDBACK_EVENTS.has(event)) {
        return;
    }

    void fetch("/api/fern-docs/feedback-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, properties })
    }).catch(() => {
        // silently ignore logging failures
    });
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
