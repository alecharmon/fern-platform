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

/**
 * Returns true if EDGE_CONFIG points to a local mock server (plain HTTP URL)
 * rather than a Vercel edge-config connection string.
 */
function isLocalEdgeConfig(): boolean {
    const edgeConfig = process.env.EDGE_CONFIG ?? "";
    return edgeConfig.startsWith("http://localhost") || edgeConfig.startsWith("http://127.0.0.1");
}

async function getFromLocalMock<T>(key: string): Promise<T | undefined> {
    const baseUrl = process.env.EDGE_CONFIG!;
    const response = await fetch(`${baseUrl}/item/${encodeURIComponent(key)}`);
    if (!response.ok) {
        return undefined;
    }
    return (await response.json()) as T;
}

async function getAllFromLocalMock<T extends Record<string, unknown>>(keys: readonly string[]): Promise<T | undefined> {
    const baseUrl = process.env.EDGE_CONFIG!;
    const response = await fetch(`${baseUrl}/?keys=${keys.map(encodeURIComponent).join(",")}`);
    if (!response.ok) {
        return undefined;
    }
    return (await response.json()) as T;
}

// avoid accessing the edge config within local development mode
export async function getEdge<T>(key: string): Promise<T | undefined> {
    if (isLocal() || isSelfHosted()) {
        return undefined;
    }

    const cacheKey = getCacheKey(key);
    const cached = getCachedValue<T>(cacheKey);
    if (cached !== null) {
        console.log(`[edge-config] getEdge("${key}") cache hit`);
        return cached;
    }

    const start = Date.now();
    let value: T | undefined;
    if (isLocalEdgeConfig()) {
        value = await getFromLocalMock<T>(key);
    } else {
        const { get } = await import("@vercel/edge-config");
        value = await get<T>(key);
    }
    const elapsed = Date.now() - start;
    console.log(`[edge-config] getEdge("${key}") took ${elapsed}ms (cache miss)`);
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
        console.log(`[edge-config] getAllEdge([${keys.join(", ")}]) cache hit`);
        return cached;
    }

    const start = Date.now();
    let value: T | undefined;
    if (isLocalEdgeConfig()) {
        value = await getAllFromLocalMock<T>(keys);
    } else {
        const { getAll } = await import("@vercel/edge-config");
        value = await getAll<T>(keys as string[]);
    }
    const elapsed = Date.now() - start;
    console.log(`[edge-config] getAllEdge([${keys.join(", ")}]) took ${elapsed}ms (cache miss)`);
    setCachedValue(cacheKey, value);
    return value;
}
