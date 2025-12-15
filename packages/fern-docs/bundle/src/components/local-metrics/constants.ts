/**
 * Get the docs bundle version from environment variable.
 * This is set during the build process from the release tag (e.g., docs@1.2.3).
 * Falls back to "unknown" if not set.
 */
function getDocsBundleVersion(): string {
    return process.env.NEXT_PUBLIC_DOCS_BUNDLE_VERSION ?? "unknown";
}

export const LOCAL_METRICS_CONFIG = {
    /** How often to send aggregate summaries (ms) */
    SUMMARY_INTERVAL_MS: 30000,

    /** Maximum samples to keep per metric type (for memory management) */
    MAX_SAMPLES_PER_METRIC: 1000,

    /** Whether to send per-event metrics (can be noisy) */
    SEND_PER_EVENT_METRICS: true,

    /** Delay before considering router.refresh() complete (existing value from websocket-refresh) */
    ROUTER_REFRESH_SETTLE_MS: 600,

    /** Source identifier for metric logs (entity@version format) */
    get METRICS_SOURCE(): string {
        return `platform@${getDocsBundleVersion()}`;
    }
};
