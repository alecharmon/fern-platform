/** biome-ignore-all lint/suspicious/noConsole: console is ok */

import { isLocal, isSelfHosted } from "@fern-api/docs-server";
import { kv } from "@vercel/kv";
import { Semaphore } from "es-toolkit";
import { after } from "next/server";

/**
 * Interface for KV cache operations
 */
export interface KvCache {
    get<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null>;
    set(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string): void;
    clear(domainKey: string): Promise<void>;
}

/**
 * In-memory cache implementation for local development
 */
class InMemoryKvCache implements KvCache {
    private cache = new Map<string, { value: unknown; expiration?: number }>();

    async get<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null> {
        const finalKey = this.buildKey(domainKey, key, cacheKeySuffix);
        const entry = this.cache.get(finalKey);

        if (!entry) {
            console.debug(`[InMemory] GET miss - domain: ${domainKey}, key: ${finalKey}`);
            return null;
        }

        // Check if expired
        if (entry.expiration && Date.now() > entry.expiration) {
            this.cache.delete(finalKey);
            console.debug(`[InMemory] GET expired - domain: ${domainKey}, key: ${finalKey}`);
            return null;
        }

        console.debug(`[InMemory] GET hit - domain: ${domainKey}, key: ${finalKey}`);
        return entry.value as T;
    }

    set(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string): void {
        const finalKey = this.buildKey(domainKey, key, cacheKeySuffix);
        const expiration = ttl && ttl > 0 ? Date.now() + ttl * 1000 : undefined;

        this.cache.set(finalKey, { value, expiration });
        console.debug(`[InMemory] SET - domain: ${domainKey}, key: ${finalKey}, ttl: ${ttl || "none"}`);
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

        console.debug(`[InMemory] Cache cleared for domainKey: ${domainKey} (${keysToDelete.length} entries)`);
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

    async get<T>(domainKey: string, key: string, cacheKeySuffix?: string): Promise<T | null> {
        if (isLocal() || isSelfHosted()) {
            return null;
        }

        const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;
        const requestKey = `${domainKey}:${finalKey}`;

        // If there's already an in-flight request, wait for it
        if (this.inFlightRequests.has(requestKey)) {
            console.debug(`[Upstash] Waiting for in-flight request - domain: ${domainKey}, key: ${finalKey}`);
            return this.inFlightRequests.get(requestKey) as Promise<T | null>;
        }

        console.debug(`[Upstash] GET operation - domain: ${domainKey}, key: ${finalKey}`);

        // Create the request promise
        const requestPromise = (async () => {
            await this.getMonitor.acquire();
            const start = Date.now();
            try {
                // Check if the key has expired
                const ttlKey = `${domainKey}:ttl:${finalKey}`;
                const expiration = await kv.get<number>(ttlKey);

                if (expiration && Date.now() > expiration) {
                    // Key has expired, delete it
                    await kv.hdel(domainKey, finalKey);
                    await kv.del(ttlKey);
                    const duration = Date.now() - start;
                    console.debug(
                        `[Upstash] GET expired - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
                    );
                    return null;
                }

                const result = await kv.hget<T>(domainKey, finalKey);
                const duration = Date.now() - start;
                const isHit = result != null;

                console.debug(
                    `[Upstash] GET ${isHit ? "hit" : "miss"} - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
                );

                return result;
            } catch (error) {
                const duration = Date.now() - start;
                console.warn(
                    `[Upstash] GET failed - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`,
                    error
                );
                return null;
            } finally {
                this.getMonitor.release();
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

    set(domainKey: string, key: string, value: unknown, ttl?: number, cacheKeySuffix?: string): void {
        if (isLocal() || isSelfHosted()) {
            return;
        }

        const finalKey = cacheKeySuffix ? `${key}:${cacheKeySuffix}` : key;

        console.debug(`[Upstash] SET operation - domain: ${domainKey}, key: ${finalKey}, ttl: ${ttl || "none"}`);

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
                console.debug(
                    `[Upstash] SET completed - domain: ${domainKey}, key: ${finalKey}, duration: ${duration}ms`
                );
            } catch (error) {
                console.warn(`[Upstash] SET failed - domain: ${domainKey}, key: ${finalKey}`, error);
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

            console.debug(`KV cache cleared for domainKey: ${domainKey}`);
        } catch (error) {
            console.error(`Failed to clear KV cache for domainKey ${domainKey}:`, error);
        }
    }
}

/**
 * Factory function to create the appropriate cache implementation
 */
export function createKvCache(isDocsDev: boolean): KvCache {
    if (isDocsDev) {
        console.debug("[KvCache] Using in-memory cache for docs development");
        return new InMemoryKvCache();
    }
    return new UpstashKvCache();
}
