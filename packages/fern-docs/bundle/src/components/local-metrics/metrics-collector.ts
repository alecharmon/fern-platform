import { LOCAL_METRICS_CONFIG } from "./constants";
import { calculateStats } from "./stats";
import type { LogLevel, MemoryInfo, MetricEvent, MetricEventType, MetricSummary, MetricsMessage } from "./types";

/** Extended Performance interface with memory info (Chrome/Edge only) */
interface PerformanceWithMemory extends Performance {
    memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
    };
}

/**
 * Collects and sends performance metrics for the local bundle development experience.
 * Metrics are sent back through the WebSocket to the Fern CLI for logging.
 */
export class LocalMetricsCollector {
    private sessionId: string;
    private sessionStart: number;
    private samples: Map<MetricEventType, number[]>;
    private ws: WebSocket | null;
    private summaryIntervalId: ReturnType<typeof setInterval> | null = null;
    private totalReloads = 0;

    constructor(ws: WebSocket | null) {
        this.sessionId = crypto.randomUUID();
        this.sessionStart = performance.now();
        this.samples = new Map();
        this.ws = ws;
    }

    /**
     * Update the WebSocket reference (e.g., after reconnection)
     */
    setWebSocket(ws: WebSocket | null): void {
        this.ws = ws;
    }

    /**
     * Record a metric event and optionally send it immediately.
     */
    record(type: MetricEventType, durationMs: number, metadata?: Record<string, unknown>): void {
        // Track reload count
        if (type === "reload_start") {
            this.totalReloads++;
        }

        // Store sample for aggregation (only if duration is meaningful)
        if (durationMs > 0) {
            const samples = this.samples.get(type) ?? [];
            samples.push(durationMs);

            // Limit samples to prevent memory issues
            if (samples.length > LOCAL_METRICS_CONFIG.MAX_SAMPLES_PER_METRIC) {
                samples.shift();
            }

            this.samples.set(type, samples);
        }

        // Send per-event metric if enabled
        if (LOCAL_METRICS_CONFIG.SEND_PER_EVENT_METRICS) {
            const event: MetricEvent = {
                type,
                timestamp: performance.now(),
                durationMs: durationMs > 0 ? durationMs : undefined,
                metadata
            };
            this.sendEvent(event);
        }
    }

    /**
     * Send an individual metric event via WebSocket.
     */
    private sendEvent(event: MetricEvent, level: LogLevel = "info"): void {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            return;
        }

        const message: MetricsMessage = {
            type: "metrics",
            timestamp: new Date().toISOString(),
            source: LOCAL_METRICS_CONFIG.METRICS_SOURCE,
            level,
            payload: event,
            isAggregate: false
        };

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.warn("[LocalMetrics] Failed to send event:", error);
        }
    }

    /**
     * Start sending periodic summary reports.
     */
    startPeriodicSummaries(intervalMs: number = LOCAL_METRICS_CONFIG.SUMMARY_INTERVAL_MS): void {
        if (this.summaryIntervalId) {
            clearInterval(this.summaryIntervalId);
        }

        this.summaryIntervalId = setInterval(() => {
            this.sendSummary();
        }, intervalMs);
    }

    /**
     * Stop periodic summaries and send a final summary.
     */
    stop(): void {
        if (this.summaryIntervalId) {
            clearInterval(this.summaryIntervalId);
            this.summaryIntervalId = null;
        }

        // Send final summary
        this.sendSummary();
    }

    /**
     * Generate and send a summary of all collected metrics.
     */
    private sendSummary(): void {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            return;
        }

        const summary = this.generateSummary();
        const message: MetricsMessage = {
            type: "metrics",
            timestamp: new Date().toISOString(),
            source: LOCAL_METRICS_CONFIG.METRICS_SOURCE,
            level: "info",
            payload: summary,
            isAggregate: true
        };

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.warn("[LocalMetrics] Failed to send summary:", error);
        }
    }

    /**
     * Record current memory usage and send as an event.
     */
    recordMemory(): void {
        const memory = this.getMemoryInfo();
        if (memory && LOCAL_METRICS_CONFIG.SEND_PER_EVENT_METRICS) {
            const event: MetricEvent = {
                type: "memory",
                timestamp: performance.now(),
                metadata: {
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit,
                    usedMB: Math.round((memory.usedJSHeapSize / 1024 / 1024) * 100) / 100,
                    totalMB: Math.round((memory.totalJSHeapSize / 1024 / 1024) * 100) / 100,
                    limitMB: Math.round((memory.jsHeapSizeLimit / 1024 / 1024) * 100) / 100
                }
            };
            this.sendEvent(event);
        }
    }

    /**
     * Get current memory usage info (Chrome/Edge only).
     */
    private getMemoryInfo(): MemoryInfo | undefined {
        if (typeof window === "undefined") {
            return undefined;
        }

        const perf = performance as PerformanceWithMemory;
        if (!perf.memory) {
            return undefined;
        }

        return {
            usedJSHeapSize: perf.memory.usedJSHeapSize,
            totalJSHeapSize: perf.memory.totalJSHeapSize,
            jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
        };
    }

    /**
     * Generate an aggregate summary from collected samples.
     */
    private generateSummary(): MetricSummary {
        return {
            sessionId: this.sessionId,
            startTime: this.sessionStart,
            endTime: performance.now(),
            totalReloads: this.totalReloads,
            metrics: {
                wsConnectionTime: calculateStats(this.samples.get("ws_connection") ?? []),
                pingPongLatency: calculateStats(this.samples.get("ws_ping_pong") ?? []),
                reloadFinishTime: calculateStats(this.samples.get("reload_finish") ?? []),
                revalidateApiTime: calculateStats(this.samples.get("revalidate_api") ?? []),
                routerRefreshTime: calculateStats(this.samples.get("router_refresh") ?? []),
                pageRenderTime: calculateStats(this.samples.get("page_render") ?? []),
                fullCycleTime: calculateStats(this.samples.get("full_cycle") ?? [])
            },
            memory: this.getMemoryInfo()
        };
    }
}
