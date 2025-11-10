import { describe, expect, it } from "vitest";
import { ResilientQueue } from "./resilient-queue";

/**
 * Simulates a file descriptor pool (like EMFILE errors)
 */
class FileDescriptorPool {
    private available: number;
    private readonly max: number;
    private waitQueue: Array<() => void> = [];

    constructor(maxDescriptors: number) {
        this.max = maxDescriptors;
        this.available = maxDescriptors;
    }

    async acquire(requestId: number): Promise<void> {
        if (this.available > 0) {
            this.available--;
            console.log(
                `[FD Pool] Request ${requestId} acquired descriptor (${this.max - this.available}/${this.max} in use)`
            );
            return;
        }

        // No descriptors available - simulate EMFILE error
        console.log(`[FD Pool] Request ${requestId} failed - EMFILE (${this.max}/${this.max} in use)`);
        throw new Error("EMFILE: too many open files");
    }

    release(requestId: number): void {
        this.available++;
        console.log(
            `[FD Pool] Request ${requestId} released descriptor (${this.max - this.available}/${this.max} in use)`
        );

        // Wake up waiting requests
        const waiter = this.waitQueue.shift();
        if (waiter) {
            waiter();
        }
    }

    getStats() {
        return {
            available: this.available,
            inUse: this.max - this.available,
            max: this.max
        };
    }
}

describe("ResilientQueue", () => {
    it("should process all items successfully", async () => {
        const items = [1, 2, 3, 4, 5];
        const processed: number[] = [];

        const queue = new ResilientQueue({
            processItem: async (item) => {
                processed.push(item);
            }
        });

        const result = await queue.process(items);

        expect(processed).toHaveLength(5);
        expect(processed).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
        expect(result.completed).toBe(5);
        expect(result.failed).toBe(0);
        expect(result.total).toBe(5);
    });

    it("should retry items that fail and eventually succeed", async () => {
        const attempts = new Map<number, number>();
        const processed: number[] = [];

        const queue = new ResilientQueue({
            processItem: async (item, attempt) => {
                const currentAttempts = attempts.get(item) || 0;
                attempts.set(item, currentAttempts + 1);

                // Fail first 2 attempts, succeed on 3rd
                if (currentAttempts < 2) {
                    throw new Error(`Attempt ${attempt} failed for item ${item}`);
                }

                processed.push(item);
            },
            maxRetries: 3,
            initialConcurrency: 1, // Serial processing for predictable test
            backoffBaseMs: 10 // Fast backoff for tests
        });

        const result = await queue.process([1, 2]);

        expect(processed).toEqual(expect.arrayContaining([1, 2]));
        expect(result.completed).toBe(2);
        expect(result.failed).toBe(0);
        expect(attempts.get(1)).toBe(3); // 3 attempts before success
        expect(attempts.get(2)).toBe(3);
    });

    it("should fail permanently after maxRetries exceeded", async () => {
        let attemptCount = 0;

        const queue = new ResilientQueue({
            processItem: async () => {
                attemptCount++;
                throw new Error("Always fails");
            },
            maxRetries: 2,
            initialConcurrency: 1,
            backoffBaseMs: 10
        });

        const result = await queue.process([1]);

        expect(result.completed).toBe(0);
        expect(result.failed).toBe(1);
        expect(attemptCount).toBe(3); // Initial attempt + 2 retries
    });

    it("should handle multiple items with different failure patterns", async () => {
        const attempts = new Map<string, number>();

        const queue = new ResilientQueue({
            processItem: async (item: string) => {
                const currentAttempts = (attempts.get(item) || 0) + 1;
                attempts.set(item, currentAttempts);

                if (item === "fail-once" && currentAttempts === 1) {
                    throw new Error("First attempt fails");
                } else if (item === "fail-always") {
                    throw new Error("Always fails");
                }
                // "success" always succeeds
            },
            maxRetries: 2,
            initialConcurrency: 1,
            backoffBaseMs: 10
        });

        const result = await queue.process(["success", "fail-once", "fail-always"]);

        expect(result.completed).toBe(2); // success + fail-once (eventually)
        expect(result.failed).toBe(1); // fail-always
        expect(attempts.get("success")).toBe(1);
        expect(attempts.get("fail-once")).toBe(2);
        expect(attempts.get("fail-always")).toBe(3);
    });

    it("should reduce concurrency on high error rate", async () => {
        const stats: number[] = [];
        let errorCount = 0;
        const totalItems = 100;

        const queue = new ResilientQueue({
            processItem: async (item: number) => {
                // First 30% of calls fail initially
                if (errorCount < 30 && item < 30) {
                    errorCount++;
                    throw new Error("Simulated error");
                }
            },
            maxRetries: 3,
            initialConcurrency: 50,
            minConcurrency: 5,
            errorRateThreshold: 0.2,
            backoffBaseMs: 10,
            onProgress: (s) => stats.push(s.currentConcurrency)
        });

        await queue.process(Array.from({ length: totalItems }, (_, i) => i));

        // Should have reduced concurrency at some point
        const minConcurrency = Math.min(...stats);
        expect(minConcurrency).toBeLessThan(50);
    });

    it("should increase concurrency on low error rate", async () => {
        const stats: number[] = [];
        const totalItems = 200;

        const queue = new ResilientQueue({
            processItem: async () => {
                // All succeed
                await new Promise((resolve) => setTimeout(resolve, 5));
            },
            initialConcurrency: 5,
            maxConcurrency: 50,
            backoffBaseMs: 10,
            onProgress: (s) => stats.push(s.currentConcurrency)
        });

        await queue.process(Array.from({ length: totalItems }, (_, i) => i));

        // Should have increased concurrency at some point
        const maxConcurrency = Math.max(...stats);
        expect(maxConcurrency).toBeGreaterThan(5);
    });

    it("should process items concurrently", async () => {
        const startTimes: Record<number, number> = {};
        const endTimes: Record<number, number> = {};

        const queue = new ResilientQueue({
            processItem: async (item: number) => {
                startTimes[item] = Date.now();
                await new Promise((resolve) => setTimeout(resolve, 50));
                endTimes[item] = Date.now();
            },
            initialConcurrency: 5
        });

        const start = Date.now();
        await queue.process([1, 2, 3, 4, 5]);
        const totalTime = Date.now() - start;

        // With concurrency 5, all 5 items should process in parallel
        // So total time should be ~50ms (one batch), not 250ms (sequential)
        expect(totalTime).toBeLessThan(150); // Allow some overhead
    });

    it("should respect concurrency limits", async () => {
        let maxConcurrent = 0;
        let currentConcurrent = 0;

        const queue = new ResilientQueue({
            processItem: async () => {
                currentConcurrent++;
                maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
                await new Promise((resolve) => setTimeout(resolve, 20));
                currentConcurrent--;
            },
            initialConcurrency: 10,
            maxConcurrency: 10
        });

        await queue.process(Array.from({ length: 50 }, (_, i) => i));

        // Should never exceed concurrency limit
        expect(maxConcurrent).toBeLessThanOrEqual(10);
    });

    it("should emit progress updates", async () => {
        const progressUpdates: Array<{
            completed: number;
            failed: number;
            inFlight: number;
            retrying: number;
        }> = [];

        const queue = new ResilientQueue({
            processItem: async (item: number) => {
                await new Promise((resolve) => setTimeout(resolve, 10));
                if (item === 5) {
                    throw new Error("Item 5 fails");
                }
            },
            maxRetries: 1,
            initialConcurrency: 2,
            backoffBaseMs: 10,
            onProgress: (stats) => {
                progressUpdates.push({
                    completed: stats.completed,
                    failed: stats.failed,
                    inFlight: stats.inFlight,
                    retrying: stats.retrying
                });
            }
        });

        await queue.process([1, 2, 3, 4, 5]);

        // Should have received progress updates
        expect(progressUpdates.length).toBeGreaterThan(0);

        // Final update should show all work complete
        const finalUpdate = progressUpdates[progressUpdates.length - 1];
        expect(finalUpdate?.completed + finalUpdate?.failed).toBe(5);
    });

    it("should handle empty input", async () => {
        const queue = new ResilientQueue({
            processItem: async () => {
                // Should never be called
                throw new Error("Should not process anything");
            }
        });

        const result = await queue.process([]);

        expect(result.completed).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.total).toBe(0);
    });

    it("should exponentially back off on retries", async () => {
        const retryTimestamps: number[] = [];

        const queue = new ResilientQueue({
            processItem: async () => {
                retryTimestamps.push(Date.now());
                throw new Error("Always fails");
            },
            maxRetries: 3,
            initialConcurrency: 1,
            backoffBaseMs: 100 // 100ms base
        });

        await queue.process([1]);

        // Should have 4 timestamps (initial + 3 retries)
        expect(retryTimestamps).toHaveLength(4);

        // Check delays between attempts
        const delay1 = retryTimestamps[1]! - retryTimestamps[0]!; // After 1st attempt: ~100ms
        const delay2 = retryTimestamps[2]! - retryTimestamps[1]!; // After 2nd attempt: ~200ms
        const delay3 = retryTimestamps[3]! - retryTimestamps[2]!; // After 3rd attempt: ~400ms

        // Allow 50% margin for timing variance
        expect(delay1).toBeGreaterThanOrEqual(50);
        expect(delay2).toBeGreaterThanOrEqual(150);
        expect(delay3).toBeGreaterThanOrEqual(300);
    });

    it("should handle EMFILE errors with limited file descriptors", async () => {
        console.log("\n=== Starting EMFILE simulation test ===\n");

        const MAX_FD = 30;
        const TOTAL_REQUESTS = 100;
        const fdPool = new FileDescriptorPool(MAX_FD);

        const completed: number[] = [];
        let totalAttempts = 0;
        let emfileErrors = 0;

        console.log(`[Test] Starting ${TOTAL_REQUESTS} requests with ${MAX_FD} file descriptors available\n`);

        const queue = new ResilientQueue({
            processItem: async (requestId: number, attempt: number) => {
                totalAttempts++;

                try {
                    // Try to acquire a file descriptor
                    await fdPool.acquire(requestId);

                    // Simulate work with random duration (50-300ms)
                    const workDuration = 50 + Math.random() * 250;
                    console.log(
                        `[Request ${requestId}] Processing (attempt ${attempt}, duration: ${workDuration.toFixed(0)}ms)`
                    );

                    await new Promise((resolve) => setTimeout(resolve, workDuration));

                    // Release the descriptor
                    fdPool.release(requestId);

                    completed.push(requestId);
                    console.log(`[Request ${requestId}] Completed successfully\n`);
                } catch (error) {
                    emfileErrors++;
                    console.log(`[Request ${requestId}] Failed with EMFILE (attempt ${attempt}/${3})\n`);
                    throw error;
                }
            },
            maxRetries: 3,
            initialConcurrency: 50, // Start high to trigger EMFILE
            maxConcurrency: 100,
            minConcurrency: 5,
            errorRateThreshold: 0.2,
            backoffBaseMs: 100,
            onProgress: (stats) => {
                const fdStats = fdPool.getStats();
                console.log(
                    `[Progress] Completed: ${stats.completed}/${stats.total} | ` +
                        `Failed: ${stats.failed} | ` +
                        `In-flight: ${stats.inFlight} | ` +
                        `Concurrency: ${stats.currentConcurrency} | ` +
                        `Error rate: ${(stats.errorRate * 100).toFixed(1)}% | ` +
                        `FD in use: ${fdStats.inUse}/${fdStats.max}\n`
                );
            }
        });

        const result = await queue.process(Array.from({ length: TOTAL_REQUESTS }, (_, i) => i));

        console.log("\n=== Test Results ===");
        console.log(`Total requests: ${TOTAL_REQUESTS}`);
        console.log(`Completed: ${result.completed}`);
        console.log(`Failed permanently: ${result.failed}`);
        console.log(`Total attempts: ${totalAttempts}`);
        console.log(`EMFILE errors encountered: ${emfileErrors}`);
        console.log(`Average attempts per request: ${(totalAttempts / TOTAL_REQUESTS).toFixed(2)}`);
        console.log("===================\n");

        // All requests should eventually complete (no permanent failures)
        expect(result.completed).toBe(TOTAL_REQUESTS);
        expect(result.failed).toBe(0);

        // We should have encountered EMFILE errors (proving the simulation works)
        expect(emfileErrors).toBeGreaterThan(0);

        // We should have retried some requests
        expect(totalAttempts).toBeGreaterThan(TOTAL_REQUESTS);

        // Final FD pool should be empty
        const finalStats = fdPool.getStats();
        expect(finalStats.available).toBe(MAX_FD);
        expect(finalStats.inUse).toBe(0);
    }, 60000); // Increase timeout to 60s for this test
});
