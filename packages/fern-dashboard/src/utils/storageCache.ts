/**
 * Caching layer for localStorage and sessionStorage reads.
 *
 * This module provides in-memory caching for storage operations to reduce
 * synchronous storage access overhead. The cache is automatically invalidated
 * on writes and handles SSR environments where storage is not available.
 */

type StorageType = "localStorage" | "sessionStorage";

interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

// In-memory cache for storage values
const cache = new Map<string, CacheEntry<unknown>>();

// No TTL by default - cache entries never expire unless explicitly invalidated
const DEFAULT_TTL_MS: number | undefined = undefined;

/**
 * Check if running in a browser environment where storage is available
 */
function isStorageAvailable(type: StorageType): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        const storage = type === "localStorage" ? window.localStorage : window.sessionStorage;
        const testKey = "__storage_test__";
        storage.setItem(testKey, testKey);
        storage.removeItem(testKey);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the storage object based on type
 */
function getStorage(type: StorageType): Storage | null {
    if (!isStorageAvailable(type)) {
        return null;
    }
    return type === "localStorage" ? window.localStorage : window.sessionStorage;
}

/**
 * Generate a cache key that includes the storage type to avoid collisions
 */
function getCacheKey(storageType: StorageType, key: string): string {
    return `${storageType}:${key}`;
}

/**
 * Get a value from storage with caching.
 *
 * @param storageType - The type of storage to use ("localStorage" or "sessionStorage")
 * @param key - The storage key
 * @param ttlMs - Optional TTL in milliseconds (default: no TTL, cache never expires)
 * @returns The raw string value from storage, or null if not found
 */
export function getCachedItem(
    storageType: StorageType,
    key: string,
    ttlMs: number | undefined = DEFAULT_TTL_MS
): string | null {
    const cacheKey = getCacheKey(storageType, key);

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
        // Check if cache entry is still valid (skip check if no TTL)
        if (ttlMs === undefined || Date.now() - cached.timestamp < ttlMs) {
            return cached.value as string | null;
        }
        // Cache expired, remove it
        cache.delete(cacheKey);
    }

    // Fetch from storage
    const storage = getStorage(storageType);
    if (!storage) {
        return null;
    }

    try {
        const value = storage.getItem(key);
        // Cache the result (including null values)
        cache.set(cacheKey, { value, timestamp: Date.now() });
        return value;
    } catch (error) {
        console.error(`Failed to get item from ${storageType}`, error);
        return null;
    }
}

/**
 * Set a value in storage and update the cache.
 *
 * @param storageType - The type of storage to use ("localStorage" or "sessionStorage")
 * @param key - The storage key
 * @param value - The value to store
 */
export function setCachedItem(storageType: StorageType, key: string, value: string): void {
    const storage = getStorage(storageType);
    if (!storage) {
        return;
    }

    try {
        storage.setItem(key, value);
        // Update cache with the new value
        const cacheKey = getCacheKey(storageType, key);
        cache.set(cacheKey, { value, timestamp: Date.now() });
    } catch (error) {
        console.error(`Failed to set item in ${storageType}`, error);
    }
}

/**
 * Remove a value from storage and invalidate the cache.
 *
 * @param storageType - The type of storage to use ("localStorage" or "sessionStorage")
 * @param key - The storage key
 */
export function removeCachedItem(storageType: StorageType, key: string): void {
    const storage = getStorage(storageType);
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(key);
        // Invalidate cache
        const cacheKey = getCacheKey(storageType, key);
        cache.delete(cacheKey);
    } catch (error) {
        console.error(`Failed to remove item from ${storageType}`, error);
    }
}

/**
 * Invalidate a specific cache entry without removing from storage.
 * Useful when you know the underlying storage may have changed externally.
 *
 * @param storageType - The type of storage
 * @param key - The storage key
 */
export function invalidateCache(storageType: StorageType, key: string): void {
    const cacheKey = getCacheKey(storageType, key);
    cache.delete(cacheKey);
}

/**
 * Clear all cache entries for a specific storage type.
 *
 * @param storageType - The type of storage to clear cache for
 */
export function clearStorageTypeCache(storageType: StorageType): void {
    const prefix = `${storageType}:`;
    const keysToDelete = Array.from(cache.keys()).filter((key) => key.startsWith(prefix));
    keysToDelete.forEach((key) => cache.delete(key));
}

/**
 * Clear the entire cache.
 */
export function clearAllCache(): void {
    cache.clear();
}

/**
 * Get a parsed JSON value from storage with caching.
 *
 * @param storageType - The type of storage to use
 * @param key - The storage key
 * @param ttlMs - Optional TTL in milliseconds
 * @returns The parsed value, or null if not found or invalid JSON
 */
export function getCachedJson<T>(storageType: StorageType, key: string, ttlMs?: number): T | null {
    const raw = getCachedItem(storageType, key, ttlMs);
    if (raw === null) {
        return null;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        console.error(`Failed to parse JSON from ${storageType} key "${key}"`);
        return null;
    }
}

/**
 * Set a JSON value in storage with caching.
 *
 * @param storageType - The type of storage to use
 * @param key - The storage key
 * @param value - The value to store (will be JSON stringified)
 */
export function setCachedJson<T>(storageType: StorageType, key: string, value: T): void {
    try {
        const serialized = JSON.stringify(value);
        setCachedItem(storageType, key, serialized);
    } catch (error) {
        console.error(`Failed to stringify value for ${storageType} key "${key}"`, error);
    }
}
