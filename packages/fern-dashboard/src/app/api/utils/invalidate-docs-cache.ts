import type { DocsUrl } from "@/utils/types";

/**
 * Fires best-effort requests to the docs site's invalidation and revalidation
 * endpoints so that caches are purged and pages regenerated immediately after
 * an auth-config change (e.g. password protection set/remove).
 *
 * The calls are intentionally best-effort: even if they fail the Edge Config
 * write already succeeded, and the docs-side in-memory cache will expire on
 * its own within a few minutes.
 */
export async function invalidateAndRevalidateDocsCache(docsUrl: DocsUrl): Promise<void> {
    const baseUrl = `https://${docsUrl}`;

    // Step 1: Invalidate — clears route cache + KV so stale data is gone.
    try {
        const res = await fetch(`${baseUrl}/api/fern-docs/invalidate`, {
            method: "GET",
            signal: AbortSignal.timeout(15_000)
        });
        await res.text();
        if (!res.ok) {
            console.warn(`[invalidate-docs-cache] invalidate responded with ${res.status} for ${docsUrl}`);
        }
    } catch (error) {
        console.warn(`[invalidate-docs-cache] Failed to invalidate ${docsUrl}:`, error);
    }

    // Step 2: Revalidate — reloads fresh data from S3 and regenerates pages.
    // Fire-and-forget: the docs server keeps the function alive via waitUntil()
    // so we only need to kick it off, not wait for the full response.
    fetch(`${baseUrl}/api/fern-docs/revalidate`, {
        method: "GET",
        signal: AbortSignal.timeout(30_000)
    }).catch((error) => {
        console.warn(`[invalidate-docs-cache] Failed to trigger revalidation for ${docsUrl}:`, error);
    });
}
