import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

export type EdgeConfigValue = Record<string, unknown> | readonly string[];

// In-memory cache for edge config values
// Cache expires after 5 minutes to balance freshness with reduced edge config reads
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
    value: T | undefined;
    timestamp: number;
}

const edgeConfigCache = new Map<string, CacheEntry<any>>();

function getCacheKey(key: string | readonly string[]): string {
    if (Array.isArray(key)) {
        return [...key].sort().join(",");
    }
    return key as string;
}

function getCachedValue<T>(cacheKey: string): T | undefined | null {
    const entry = edgeConfigCache.get(cacheKey);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.value;
    }
    return null; // null indicates cache miss
}

function setCachedValue<T>(cacheKey: string, value: T | undefined): void {
    edgeConfigCache.set(cacheKey, {
        value,
        timestamp: Date.now()
    });
}

// avoid accessing the edge config within local development mode
export async function getEdge<T>(key: string): Promise<T | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    const cacheKey = getCacheKey(key);
    const cached = getCachedValue<T>(cacheKey);
    if (cached !== null) {
        return cached;
    }

    const { get } = await import("@vercel/edge-config");
    const value = await get<T>(key);
    setCachedValue(cacheKey, value);
    return value;
}

export async function getAllEdge<T extends Record<string, unknown>>(keys: readonly string[]): Promise<T | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    const cacheKey = getCacheKey(keys);
    const cached = getCachedValue<T>(cacheKey);
    if (cached !== null) {
        return cached;
    }

    const { getAll } = await import("@vercel/edge-config");
    const value = await getAll<T>(keys as string[]);
    setCachedValue(cacheKey, value);
    return value;
}
