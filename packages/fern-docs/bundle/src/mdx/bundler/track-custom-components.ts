import "server-only";

import { track } from "@fern-api/docs-server";
import { logger } from "@fern-api/ui-core-utils/logger";

// Track last event time for custom components to avoid spamming (10 minute throttle)
const customComponentsEventCache = new Map<string, number>();
const CUSTOM_COMPONENTS_EVENT_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Periodically clean up old entries to prevent memory leaks
let cleanupIntervalId: NodeJS.Timeout | undefined;

function startCacheCleanup() {
    if (cleanupIntervalId != null) {
        return; // Already started
    }

    cleanupIntervalId = setInterval(() => {
        const now = Date.now();
        const keysToDelete: string[] = [];

        // Find entries older than the throttle time
        for (const [key, timestamp] of customComponentsEventCache.entries()) {
            if (now - timestamp >= CUSTOM_COMPONENTS_EVENT_THROTTLE_MS) {
                keysToDelete.push(key);
            }
        }

        // Delete old entries
        for (const key of keysToDelete) {
            customComponentsEventCache.delete(key);
        }

        if (keysToDelete.length > 0) {
            logger.debug(
                `[trackCustomComponents] Cleaned up ${keysToDelete.length} old entries from cache. Current size: ${customComponentsEventCache.size}`
            );
        }
    }, CACHE_CLEANUP_INTERVAL_MS);

    // Don't keep the process alive just for this cleanup
    cleanupIntervalId.unref();
}

/**
 * Track usage of custom components for a given org and domain.
 * This function is throttled to once per 10 minutes per org-domain combination.
 *
 * @param org - The organization name
 * @param domain - The domain using custom components
 * @param files - Record of custom component files
 */
export function trackCustomComponents(org: string, domain: string, files: Record<string, string>): void {
    // Start cleanup interval on first call
    if (cleanupIntervalId == null) {
        startCacheCleanup();
    }

    try {
        const cacheKey = `${org}_${domain}`;
        const now = Date.now();
        const lastEventTime = customComponentsEventCache.get(cacheKey);

        // Only track if we haven't tracked this org-domain in the last 10 minutes
        if (lastEventTime == null || now - lastEventTime >= CUSTOM_COMPONENTS_EVENT_THROTTLE_MS) {
            track("custom_components_rendered", {
                org,
                domain,
                fileCount: Object.keys(files).length
            });
            customComponentsEventCache.set(cacheKey, now);
        }
    } catch (error) {
        logger.error("[trackCustomComponents] Failed to track custom components usage", error);
    }
}

/**
 * Clear the custom components tracking cache.
 * Useful for testing or manual cleanup.
 */
export function clearCustomComponentsCache(): void {
    customComponentsEventCache.clear();
}

/**
 * Stop the cache cleanup interval.
 * Useful for testing or graceful shutdown.
 */
export function stopCacheCleanup(): void {
    if (cleanupIntervalId != null) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = undefined;
    }
}
