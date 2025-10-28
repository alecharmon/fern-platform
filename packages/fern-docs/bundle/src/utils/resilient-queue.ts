/**
 * Statistics about queue processing
 */
export interface QueueStats {
    /** Total number of items to process */
    total: number;
    /** Number of successfully completed items */
    completed: number;
    /** Number of permanently failed items (after max retries) */
    failed: number;
    /** Number of items currently being processed */
    inFlight: number;
    /** Number of items waiting to be retried */
    retrying: number;
    /** Current concurrency level */
    currentConcurrency: number;
    /** Current error rate (0-1) */
    errorRate: number;
}

/**
 * Configuration options for ResilientQueue
 */
export interface ResilientQueueOptions<T> {
    /** Function that processes a single work item */
    processItem: (item: T, attempt: number) => Promise<void>;

    /** Maximum retry attempts for failed items (default: 3) */
    maxRetries?: number;

    /** Initial concurrency level (default: 20) */
    initialConcurrency?: number;

    /** Maximum concurrency level (default: 100) */
    maxConcurrency?: number;

    /** Minimum concurrency level (default: 5) */
    minConcurrency?: number;

    /** Error rate threshold to trigger backoff (0-1, default: 0.2) */
    errorRateThreshold?: number;

    /** Exponential backoff base in ms (default: 1000) */
    backoffBaseMs?: number;

    /** Optional callback for observability */
    onProgress?: (stats: QueueStats) => void;
}

interface WorkItem<T> {
    data: T;
    retries: number;
}

/**
 * A resilient queue that handles retries with exponential backoff and adaptive concurrency.
 *
 * Features:
 * - Retries all errors up to maxRetries
 * - Failed items go to end of queue with exponential backoff
 * - Dynamically adjusts concurrency based on error rate
 * - Provides progress callbacks for observability
 *
 * @example
 * ```typescript
 * const queue = new ResilientQueue({
 *   processItem: async (url) => {
 *     await fetch(url);
 *   },
 *   maxRetries: 3,
 *   initialConcurrency: 20
 * });
 *
 * const result = await queue.process(urls);
 * console.log(`Completed: ${result.completed}, Failed: ${result.failed}`);
 * ```
 */
export class ResilientQueue<T> {
    private readonly processItem: (item: T, attempt: number) => Promise<void>;
    private readonly maxRetries: number;
    private readonly maxConcurrency: number;
    private readonly minConcurrency: number;
    private readonly errorRateThreshold: number;
    private readonly backoffBaseMs: number;
    private readonly onProgress?: (stats: QueueStats) => void;

    private queue: WorkItem<T>[] = [];
    private inFlight = 0;
    private concurrency: number;
    private completed = 0;
    private failed = 0;
    private errorRate = 0;
    private lastProgressEmit = 0;

    constructor(options: ResilientQueueOptions<T>) {
        this.processItem = options.processItem;
        this.maxRetries = options.maxRetries ?? 3;
        this.concurrency = options.initialConcurrency ?? 20;
        this.maxConcurrency = options.maxConcurrency ?? 100;
        this.minConcurrency = options.minConcurrency ?? 5;
        this.errorRateThreshold = options.errorRateThreshold ?? 0.2;
        this.backoffBaseMs = options.backoffBaseMs ?? 1000;
        this.onProgress = options.onProgress;
    }

    /**
     * Process all items in the queue with adaptive concurrency and retry logic
     */
    async process(items: T[]): Promise<QueueStats> {
        // Initialize queue
        this.queue = items.map((data) => ({ data, retries: 0 }));
        this.completed = 0;
        this.failed = 0;
        this.inFlight = 0;
        this.errorRate = 0;

        const total = items.length;

        // Spawn worker pool
        const workers: Promise<void>[] = [];
        for (let i = 0; i < this.concurrency; i++) {
            workers.push(this.worker());
        }

        // Wait for all workers to complete
        await Promise.all(workers);

        // Final progress update
        this.emitProgress(total, true);

        return this.getStats(total);
    }

    private async worker(): Promise<void> {
        while (true) {
            const item = this.queue.shift();
            if (!item) {
                // No more work
                break;
            }

            // Check if we should throttle based on current concurrency
            while (this.inFlight >= this.concurrency) {
                // Wait a bit before checking again
                await this.delay(50);
            }

            this.inFlight++;

            try {
                await this.processItem(item.data, item.retries + 1);
                this.recordSuccess();
                this.completed++;
            } catch (error) {
                await this.handleError(error as Error, item);
            } finally {
                this.inFlight--;
            }

            // Emit progress periodically
            this.emitProgress(this.queue.length + this.completed + this.failed + this.inFlight);
        }
    }

    private async handleError(error: Error, item: WorkItem<T>): Promise<void> {
        this.recordError();

        if (item.retries < this.maxRetries) {
            // Calculate exponential backoff delay
            const backoffMs = Math.pow(2, item.retries) * this.backoffBaseMs;

            // Wait before re-queueing
            await this.delay(backoffMs);

            // Re-queue at end with incremented retry count
            this.queue.push({
                data: item.data,
                retries: item.retries + 1
            });
        } else {
            // Max retries exceeded, mark as permanently failed
            this.failed++;
        }
    }

    private recordSuccess(): void {
        // Decay error rate on success (exponentially weighted moving average)
        this.errorRate = this.errorRate * 0.9;

        // Adjust concurrency if error rate is low
        this.adjustConcurrency();
    }

    private recordError(): void {
        // Increase error rate on error (exponentially weighted moving average)
        this.errorRate = Math.min(1, this.errorRate * 0.9 + 0.1);

        // Adjust concurrency if error rate is high
        this.adjustConcurrency();
    }

    private adjustConcurrency(): void {
        if (this.errorRate > this.errorRateThreshold) {
            // High error rate - back off conservatively (halve)
            const newConcurrency = Math.max(this.minConcurrency, Math.floor(this.concurrency * 0.5));

            if (newConcurrency !== this.concurrency) {
                this.concurrency = newConcurrency;
            }
        } else if (this.errorRate < 0.05 && this.concurrency < this.maxConcurrency) {
            // Low error rate - gradually increase
            this.concurrency = Math.min(this.maxConcurrency, this.concurrency + 5);
        }
    }

    private getStats(total: number): QueueStats {
        return {
            total,
            completed: this.completed,
            failed: this.failed,
            inFlight: this.inFlight,
            retrying: this.queue.length,
            currentConcurrency: this.concurrency,
            errorRate: this.errorRate
        };
    }

    private emitProgress(total: number, force = false): void {
        if (!this.onProgress) {
            return;
        }

        const now = Date.now();
        // Emit at most once per second, or when forced
        if (force || now - this.lastProgressEmit > 1000) {
            this.lastProgressEmit = now;
            try {
                this.onProgress(this.getStats(total));
            } catch (e) {
                console.error("[ResilientQueue] onProgress callback threw an error:", e);
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
