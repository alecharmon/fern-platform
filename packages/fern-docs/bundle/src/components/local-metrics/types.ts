/**
 * Types for local bundle metrics collection.
 * These metrics track performance of the hot-reload development experience.
 */

/** Individual metric event types */
export type MetricEventType =
    | "ws_connection"
    | "ws_ping_pong"
    | "reload_start"
    | "reload_finish"
    | "revalidate_api"
    | "router_refresh"
    | "page_render"
    | "full_cycle"
    | "memory";

/** Individual metric event payload */
export interface MetricEvent {
    type: MetricEventType;
    /** performance.now() at event time */
    timestamp: number;
    /** duration in ms (for completed events) */
    durationMs?: number;
    /** additional context */
    metadata?: Record<string, unknown>;
}

/** Statistical summary for a metric type */
export interface StatsSummary {
    count: number;
    min: number;
    max: number;
    avg: number;
}

/** Memory usage snapshot (from performance.memory API) */
export interface MemoryInfo {
    /** Currently used JS heap size in bytes */
    usedJSHeapSize: number;
    /** Total allocated JS heap size in bytes */
    totalJSHeapSize: number;
    /** Maximum JS heap size limit in bytes */
    jsHeapSizeLimit: number;
}

/** Aggregate statistics for periodic summaries */
export interface MetricSummary {
    sessionId: string;
    /** session start timestamp (performance.now()) */
    startTime: number;
    /** summary generation timestamp (performance.now()) */
    endTime: number;
    totalReloads: number;
    metrics: {
        wsConnectionTime: StatsSummary;
        pingPongLatency: StatsSummary;
        reloadFinishTime: StatsSummary;
        revalidateApiTime: StatsSummary;
        routerRefreshTime: StatsSummary;
        pageRenderTime: StatsSummary;
        fullCycleTime: StatsSummary;
    };
    /** Current memory usage (if available) */
    memory?: MemoryInfo;
}

/** Log level for metric messages */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** WebSocket message format for metrics */
export interface MetricsMessage {
    type: "metrics";
    /** ISO 8601 timestamp when the log was sent */
    timestamp: string;
    /** The entity and version that created the log (e.g., platform@local-bundle) */
    source: string;
    /** The log level */
    level: LogLevel;
    payload: MetricEvent | MetricSummary;
    isAggregate: boolean;
}
