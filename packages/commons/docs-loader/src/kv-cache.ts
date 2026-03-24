import { isLocal, isSelfHosted } from "@fern-api/docs-server";
import { logger } from "@fern-api/ui-core-utils/logger";
import { kv } from "@vercel/kv";
import { Semaphore } from "es-toolkit";
import { after } from "next/server";

/**
 * Interface for KV cache operations
 */
export interface KvCache {
    get<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null>;
    mget(domainKey: string, keys: string[], cacheKeySuffix?: string): Promise<Map<string, unknown>>;
    set(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string): void;
    clear(domainKey: string): Promise<void>;
}

/**
 * No-op cache implementation for local CLI development (fern docs dev)
 * This ensures hot reload works by never caching any data
 */
class NoOpKvCache implements KvCache {
    async get<T>(_domainKey: string, _key: string, _cacheKeySuffix?: string): Promise<T | null> {
        // Never return cached data - always fetch fresh
        return null;
    }

    async mget(_domainKey: string, _keys: string[], _cacheKeySuffix?: string): Promise<Map<string, unknown>> {
        // Never return cached data - always fetch fresh
        return new Map();
    }

    set(_domainKey: string, _key: string, _value: unknown, _ttl?: number, _cacheKeySuffix?: string): void {
        // Don't cache anything
    }

    async clear(_domainKey: string): Promise<void> {
        // Nothing to clear
    }
}

/**
 * In-memory cache implementation for local development (pnpm docs:dev in monorepo)
 * When isLocal() is true (fern docs dev CLI), all operations are no-ops to enable hot reload
 */
class InMemoryKvCache implements KvCache {
    private cache = new Map<string, { value: unknown; expiration?: number }>();

    async get<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null> {
        const finalKey = this.buildKey(domainKey, key, cacheKeySuffix);
        const entry = this.cache.get(finalKey);

        if (!entry) {
            logger.debug(`[InMemory] GET miss - domain: ${domainKey}, key: ${finalKey}`);
            return null;
        }

        // Check if expired
        if (entry.expiration && Date.now() > entry.expiration) {
            this.cache.delete(finalKey);
            logger.debug(`[InMemory] GET expired - domain: ${domainKey}, key: ${finalKey}`);
            return null;
        }

        logger.debug(`[InMemory] GET hit - domain: ${domainKey}, key: ${finalKey}`);
        return entry.value as T;
    }

    async mget(domainKey: string, keys: string[], cacheKeySuffix?: string): Promise<Map<string, unknown>> {
        const result = new Map<string, unknown>();
        const now = Date.now();

        for (const key of keys) {
            const finalKey = this.buildKey(domainKey, key, cacheKeySuffix);
            const entry = this.cache.get(finalKey);

            if (entry && (!entry.expiration || now <= entry.expiration)) {
                result.set(key, entry.value);
            }
        }

        logger.debug(`[InMemory] MGET - domain: ${domainKey}, requested: ${keys.length}, found: ${result.size}`);
        return result;
    }

    set(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string): void {
        const finalKey = this.buildKey(domainKey, key, cacheKeySuffix);
        const expiration = ttl && ttl > 0 ? Date.now() + ttl * 1000 : undefined;

        this.cache.set(finalKey, { value, expiration });
        logger.debug(`[InMemory] SET - domain: ${domainKey}, key: ${finalKey}, ttl: ${ttl || "none"}`);
    }

    async clear(domainKey: string): Promise<void> {
        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${domainKey}:`)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.cache.delete(key);
        }

        logger.debug(`[InMemory] Cache cleared for domainKey: ${domainKey} (${keysToDelete.length} entries)`);
    }

    private buildKey(domainKey: string, key: string, cacheKeySuffix?: string): string {
        return cacheKeySuffix ? `${domainKey}:${key}:${cacheKeySuffix}` : `${domainKey}:${key}`;
    }
}

/**
 * Upstash KV cache implementation (production)
 */
class UpstashKvCache implements KvCache {
    private setMonitor = new Semaphore(10);
    private getMonitor = new Semaphore(10);
    private inFlightRequests = new Map<string, Promise<any>>();
    private inFlightBatchRequests = new Map<string, Promise<Map<string, unknown>>>();

    async get<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null> {
        if (isLocal() || isSelfHosted()) {
            return null;
        }

        const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;
        const requestKey = `${domainKey}:${finalKey}`;

        // If there's already an in-flight request, wait for it
        if (this.inFlightRequests.has(requestKey)) {
            const waitStart = Date.now();
            logger.debug(`[Upstash] Waiting for in-flight request - domain: ${domainKey}, key: ${finalKey}`);
            const result = (await this.inFlightRequests.get(requestKey)) as Promise<T | null>;
            const waitDuration = Date.now() - waitStart;
            logger.debug(
                `[Upstash] In-flight request completed after ${waitDuration}ms - domain: ${domainKey}, key: ${finalKey}`
            );
            return result;
        }

        logger.debug(`[Upstash] GET operation - domain: ${domainKey}, key: ${finalKey}`);

        // Create the request promise
        const requestPromise = (async () => {
            const acquireStart = Date.now();
            logger.debug(`[Upstash] GET acquire start - domain: ${domainKey}, key: ${finalKey}`);
            await this.getMonitor.acquire();
            const acquireDuration = Date.now() - acquireStart;
            logger.debug(`[Upstash] GET acquired in ${acquireDuration}ms - domain: ${domainKey}, key: ${finalKey}`);

            const start = Date.now();
            try {
                // Check if the key has expired
                const ttlKey = `${domainKey}:ttl:${finalKey}`;
                const ttlStart = Date.now();
                logger.debug(`[Upstash] GET ttl start - domain: ${domainKey}, key: ${ttlKey}`);
                const expiration = await kv.get<number>(ttlKey);
                const ttlDuration = Date.now() - ttlStart;
                logger.debug(
                    `[Upstash] GET ttl done in ${ttlDuration}ms - domain: ${domainKey}, key: ${ttlKey}, value: ${expiration}`
                );

                if (ttlDuration > 2000) {
                    logger.warn(
                        `[Upstash] GET slow ttl check took ${ttlDuration}ms - domain: ${domainKey}, key: ${finalKey}`
                    );
                }

                if (expiration && Date.now() > expiration) {
                    // Key has expired, delete it
                    logger.debug(`[Upstash] GET deleting expired key - domain: ${domainKey}, key: ${finalKey}`);
                    await kv.hdel(domainKey, finalKey);
                    await kv.del(ttlKey);
                    const duration = Date.now() - start;
                    logger.debug(
                        `[Upstash] GET expired - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
                    );
                    return null;
                }

                const hgetStart = Date.now();
                logger.debug(`[Upstash] GET hget start - domain: ${domainKey}, key: ${finalKey}`);
                const result = await kv.hget<T>(domainKey, finalKey);
                const hgetDuration = Date.now() - hgetStart;
                const duration = Date.now() - start;
                const isHit = result != null;

                logger.debug(
                    `[Upstash] GET ${isHit ? "hit" : "miss"} - domain: ${domainKey}, key: ${finalKey}, hget: ${hgetDuration}ms, total: ${duration}ms`
                );

                if (hgetDuration > 2000) {
                    logger.warn(
                        `[Upstash] GET slow hget took ${hgetDuration}ms - domain: ${domainKey}, key: ${finalKey}`
                    );
                }

                return result;
            } catch (error) {
                const duration = Date.now() - start;
                logger.warn(
                    `[Upstash] GET failed - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`,
                    error
                );
                return null;
            } finally {
                this.getMonitor.release();
                logger.debug(`[Upstash] GET released semaphore - domain: ${domainKey}, key: ${finalKey}`);
            }
        })();

        // Store the promise and remove it when done
        this.inFlightRequests.set(requestKey, requestPromise);
        requestPromise
            .finally(() => {
                this.inFlightRequests.delete(requestKey);
            })
            .catch(() => {
                // Errors are already handled in the main promise, this is just for cleanup
            });

        return requestPromise;
    }

    async mget(domainKey: string, keys: string[], cacheKeySuffix?: string): Promise<Map<string, unknown>> {
        if (isLocal() || isSelfHosted()) {
            return new Map();
        }

        if (keys.length === 0) {
            return new Map();
        }

        const batchKey = `${domainKey}:${keys.join(",")}:${cacheKeySuffix || ""}`;

        // If there's already an in-flight batch request for these exact keys, wait for it
        if (this.inFlightBatchRequests.has(batchKey)) {
            const waitStart = Date.now();
            logger.debug(`[Upstash] Waiting for in-flight batch request - domain: ${domainKey}, keys: ${keys.length}`);
            const result = await this.inFlightBatchRequests.get(batchKey)!;
            const waitDuration = Date.now() - waitStart;
            logger.debug(
                `[Upstash] In-flight batch request completed after ${waitDuration}ms - domain: ${domainKey}, keys: ${keys.length}`
            );
            return result;
        }

        logger.debug(`[Upstash] MGET operation - domain: ${domainKey}, keys: ${keys.length}`);

        // Create the batch request promise
        const requestPromise = (async () => {
            const acquireStart = Date.now();
            logger.debug(`[Upstash] MGET acquire start - domain: ${domainKey}, keys: ${keys.length}`);
            await this.getMonitor.acquire();
            const acquireDuration = Date.now() - acquireStart;
            logger.debug(
                `[Upstash] MGET acquired in ${acquireDuration}ms - domain: ${domainKey}, keys: ${keys.length}`
            );

            const start = Date.now();
            try {
                const finalKeys = keys.map((key) => (cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key));

                const pipeline = kv.pipeline();

                for (const finalKey of finalKeys) {
                    const ttlKey = `${domainKey}:ttl:${finalKey}`;
                    pipeline.get<number>(ttlKey);
                }

                for (const finalKey of finalKeys) {
                    pipeline.hget(domainKey, finalKey);
                }

                const pipelineStart = Date.now();
                logger.debug(`[Upstash] MGET pipeline start - domain: ${domainKey}, keys: ${keys.length}`);
                const results = await pipeline.exec();
                const pipelineDuration = Date.now() - pipelineStart;
                logger.debug(
                    `[Upstash] MGET pipeline done in ${pipelineDuration}ms - domain: ${domainKey}, keys: ${keys.length}`
                );

                if (pipelineDuration > 2000) {
                    logger.warn(
                        `[Upstash] MGET slow pipeline took ${pipelineDuration}ms - domain: ${domainKey}, keys: ${keys.length}`
                    );
                }

                const resultMap = new Map<string, unknown>();
                const now = Date.now();
                const keysToDelete: string[] = [];

                const halfLength = results.length / 2;
                for (let i = 0; i < halfLength; i++) {
                    const ttlResult = results[i];
                    const valueResult = results[i + halfLength];
                    const originalKey = keys[i];
                    const finalKey = finalKeys[i];

                    if (!originalKey || !finalKey) {
                        continue;
                    }

                    // Check if key has expired
                    if (ttlResult && typeof ttlResult === "number" && now > ttlResult) {
                        // Key has expired, mark for deletion
                        keysToDelete.push(finalKey);
                        continue;
                    }

                    if (valueResult != null) {
                        resultMap.set(originalKey, valueResult);
                    }
                }

                if (keysToDelete.length > 0) {
                    after(async () => {
                        try {
                            const deletePipeline = kv.pipeline();
                            for (const finalKey of keysToDelete) {
                                deletePipeline.hdel(domainKey, finalKey);
                                deletePipeline.del(`${domainKey}:ttl:${finalKey}`);
                            }
                            await deletePipeline.exec();
                            logger.debug(
                                `[Upstash] MGET cleaned up ${keysToDelete.length} expired keys - domain: ${domainKey}`
                            );
                        } catch (error) {
                            logger.warn(`[Upstash] MGET failed to clean up expired keys - domain: ${domainKey}`, error);
                        }
                    });
                }

                const duration = Date.now() - start;
                logger.debug(
                    `[Upstash] MGET completed - domain: ${domainKey}, requested: ${keys.length}, found: ${resultMap.size}, total: ${duration}ms`
                );

                return resultMap;
            } catch (error) {
                const duration = Date.now() - start;
                logger.warn(
                    `[Upstash] MGET failed - domain: ${domainKey}, keys: ${keys.length}, duration: ${duration}ms`,
                    error
                );
                return new Map();
            } finally {
                this.getMonitor.release();
                logger.debug(`[Upstash] MGET released semaphore - domain: ${domainKey}, keys: ${keys.length}`);
            }
        })();

        // Store the promise and remove it when done
        this.inFlightBatchRequests.set(batchKey, requestPromise);
        requestPromise
            .finally(() => {
                this.inFlightBatchRequests.delete(batchKey);
            })
            .catch(() => {
                // Errors are already handled in the main promise, this is just for cleanup
            });

        return requestPromise;
    }

    set(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string): void {
        if (isLocal() || isSelfHosted()) {
            return;
        }

        const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;

        logger.debug(`[Upstash] SET operation - domain: ${domainKey}, key: ${finalKey}, ttl: ${ttl || "none"}`);

        after(async () => {
            await this.setMonitor.acquire();
            const start = Date.now();
            try {
                if (ttl && ttl > 0) {
                    await kv.hset(domainKey, { [finalKey]: value });
                    // Set expiration for the hash field (note: Redis doesn't support per-field TTL in hashes)
                    // So we'll use a separate key for TTL tracking
                    await kv.setex(`${domainKey}:ttl:${finalKey}`, ttl, Date.now() + ttl * 1000);
                } else {
                    await kv.hset(domainKey, { [finalKey]: value });
                }
                const duration = Date.now() - start;
                logger.debug(
                    `[Upstash] SET completed - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
                );
            } catch (error) {
                logger.warn(`[Upstash] SET failed - domain: ${domainKey}, key: ${finalKey}`, error);
            } finally {
                this.setMonitor.release();
            }
        });
    }

    async clear(domainKey: string): Promise<void> {
        if (isLocal() || isSelfHosted()) {
            return;
        }

        try {
            // Clear KV cache for domainKey
            const keys = await kv.hkeys(domainKey);
            if (keys.length > 0) {
                await kv.hdel(domainKey, ...keys);
            }

            // Clear TTL tracking keys
            const ttlKeys = await kv.keys(`${domainKey}:ttl:*`);
            if (ttlKeys.length > 0) {
                await kv.del(...ttlKeys);
            }

            logger.debug(`KV cache cleared for domainKey: ${domainKey}`);
        } catch (error) {
            logger.error(`[kv-cache] Failed to clear KV cache for domainKey ${domainKey}:`, error);
        }
    }
}

/**
 * Factory function to create the appropriate cache implementation
 *
 * - isLocalDev() = true (fern docs dev CLI): No caching at all for hot reload to work
 * - isDocsDev = true (pnpm docs:dev in monorepo): In-memory cache
 * - isSelfHosted() = true: In-memory cache (no Upstash available)
 * - Production: Upstash KV cache
 */
export function createKvCache(isDocsDev: boolean): KvCache {
    // For local CLI development (fern docs dev), disable all caching
    // This ensures hot reload works by fetching fresh data on every request
    // Use local check instead of imported isLocal() to avoid Next.js env var inlining issues
    if (isLocal()) {
        logger.debug("[KvCache] Using no-op cache for local CLI development (hot reload enabled)");
        return new NoOpKvCache();
    }
    // Local infra stack (pnpm docs:dev:local) — use Upstash backed by local Redis mock
    if (process.env.LOCAL_INFRA_STACK === "true") {
        logger.debug("[KvCache] Using Upstash cache for local infra stack");
        return new UpstashKvCache();
    }
    // For monorepo docs development (pnpm docs:dev) or self-hosted mode, use in-memory cache
    // Self-hosted mode doesn't have access to Upstash, so we use in-memory cache for ISR to work
    if (isDocsDev || isSelfHosted()) {
        logger.debug("[KvCache] Using in-memory cache for docs development or self-hosted mode");
        return new InMemoryKvCache();
    }
    return new UpstashKvCache();
}
