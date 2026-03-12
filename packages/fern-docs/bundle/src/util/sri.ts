import { logger } from "@fern-api/ui-core-utils/logger";
import crypto from "crypto";
import { unstable_cache } from "next/cache";

const FETCH_TIMEOUT = 10000; // 10 seconds
const SRI_ALGORITHM = "sha256" as const;
const CACHE_TTL = 60 * 60; // 1 hour in seconds

/**
 * Internal function that actually fetches and computes the SRI hash.
 * This is wrapped by unstable_cache for Next.js caching.
 * Exported for testing purposes.
 */
export async function computeSriHashUncached(
    url: string,
    algorithm: "sha256" | "sha384" | "sha512"
): Promise<string | undefined> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Fern-Docs/1.0",
                Accept: "application/javascript, text/javascript, */*"
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            logger.warn(`[SRI] Failed to fetch script for integrity hash: ${url} (${response.status})`);
            return undefined;
        }

        // Check if the script supports CORS (required for SRI with integrity attribute)
        // SRI requires crossOrigin="anonymous", which requires CORS headers on the script
        const corsHeader = response.headers.get("Access-Control-Allow-Origin");
        if (!corsHeader) {
            logger.warn(
                `[SRI] Script does not support CORS (no Access-Control-Allow-Origin header), skipping integrity hash: ${url}`
            );
            return undefined;
        }

        // Get the script content as a buffer
        const buffer = await response.arrayBuffer();

        // Compute the hash
        const hash = crypto.createHash(algorithm).update(Buffer.from(buffer)).digest("base64");
        const integrity = `${algorithm}-${hash}`;

        return integrity;
    } catch (error) {
        if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
            logger.warn(`[SRI] Timeout fetching script for integrity hash: ${url}`);
        } else {
            logger.error(`[SRI] Error computing integrity hash for ${url}:`, error);
        }
        return undefined;
    }
}

/**
 * Computes the SRI (Subresource Integrity) hash for a remote script URL.
 * Uses sha256 algorithm by default.
 * Results are cached using Next.js's unstable_cache for 1 hour.
 */
export const computeSriHash = unstable_cache(computeSriHashUncached, ["sri-hash"], {
    revalidate: CACHE_TTL,
    tags: ["sri"]
});

/**
 * Enriches remote script configurations with integrity hashes.
 * Computes hashes only for scripts that don't already have an integrity value.
 */
export async function enrichRemoteScriptsWithIntegrity<
    T extends { url: string; strategy?: string; integrity?: string }
>(
    remote: T[] | undefined,
    hashFn: (url: string, algorithm: "sha256" | "sha384" | "sha512") => Promise<string | undefined> = (url) =>
        computeSriHash(url, SRI_ALGORITHM)
): Promise<T[] | undefined> {
    if (!remote || remote.length === 0) {
        return remote;
    }

    // Compute integrity hashes for all remote scripts in parallel
    const enrichedRemote = await Promise.all(
        remote.map(async (script) => {
            // Skip if integrity is already provided (pre-computed in FDR)
            if (script.integrity) {
                return script;
            }

            // Compute integrity hash at runtime
            const integrity = await hashFn(script.url, SRI_ALGORITHM);

            return {
                ...script,
                integrity
            } as T;
        })
    );

    return enrichedRemote;
}
