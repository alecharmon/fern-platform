/**
 * In-memory LRU (Least Recently Used) cache implementation.
 */

import { MAX_CACHE_SIZE } from "./config";

export interface CacheEntry {
    statusCode: number;
    headers: Record<string, string | string[] | number | undefined>;
    body: Buffer;
    cachedAt: number;
    expiresAt: number | null;
}

export type CacheValue = Omit<CacheEntry, "cachedAt" | "expiresAt">;

export class LRUCache {
    private maxSize: number;
    private cache: Map<string, CacheEntry>;
    private _hits: number;
    private _misses: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this._hits = 0;
        this._misses = 0;
    }

    get(key: string): CacheEntry | null {
        if (!this.cache.has(key)) {
            this._misses++;
            return null;
        }

        const entry = this.cache.get(key)!;

        // Check if expired
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            this._misses++;
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this._hits++;
        return entry;
    }

    set(key: string, value: CacheValue, ttlSeconds: number): void {
        // Delete if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest if at capacity
        while (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        const entry: CacheEntry = {
            ...value,
            cachedAt: Date.now(),
            expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
        };

        this.cache.set(key, entry);
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    // Delete entries matching a pattern (for cache invalidation)
    invalidatePattern(pattern: string): number {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    stats(): { size: number; maxSize: number; hits: number; misses: number; hitRate: string } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this._hits,
            misses: this._misses,
            hitRate:
                this._hits + this._misses > 0
                    ? ((this._hits / (this._hits + this._misses)) * 100).toFixed(2) + "%"
                    : "N/A"
        };
    }
}

export const cache = new LRUCache(MAX_CACHE_SIZE);
