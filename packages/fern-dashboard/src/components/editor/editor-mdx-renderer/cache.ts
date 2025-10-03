import { bundleEditorMDX } from "@/app/[orgName]/(visual-editor)/editor/[docsUrl]/[branch]/[...slug]/bundleEditorMdx";
import { EncodedDocsUrl } from "@/utils/types";

interface CacheEntry {
  code: string;
  error?: string;
  timestamp: number;
}

// Cache for bundled MDX with TTL
const bundleCache = new Map<string, CacheEntry>();

// Time-to-live in milliseconds (10 minutes)
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Process a batch of pending requests
 */
async function processBatch(
  requests: PendingRequest[],
  options?: {
    docsUrl?: EncodedDocsUrl;
    branch?: string;
  }
): Promise<void> {
  // Get unique MDX sources to bundle
  const uniqueSources = Array.from(new Set(requests.map((req) => req.mdx)));

  try {
    // Bundle all unique sources at once
    const results = await bundleEditorMDX(uniqueSources, options);

    // Create a map of source to result
    const resultMap = new Map<string, (typeof results)[0]>();
    uniqueSources.forEach((source, index) => {
      const result = results[index];
      if (result) {
        resultMap.set(source, result);
      }
    });

    // Process each request
    requests.forEach((request) => {
      const result = resultMap.get(request.mdx);

      if (!result) {
        request.reject(new Error("Failed to get result from batch"));
        return;
      }

      if (result.ok) {
        // Cache the successful result
        bundleCache.set(request.mdx, {
          code: result.code,
          timestamp: Date.now(),
        });
        request.resolve({ code: result.code });
      } else {
        // Cache the error
        bundleCache.set(request.mdx, {
          code: "",
          error: result.error,
          timestamp: Date.now(),
        });
        request.reject(new Error(result.error));
      }
    });
  } catch (error) {
    // If the entire batch fails, reject all requests
    const errorMessage = error instanceof Error ? error.message : String(error);
    requests.forEach((request) => {
      request.reject(new Error(errorMessage));
    });
  }
}

/**
 * Evicts cache entries older than the TTL
 */
function evictStaleEntries(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [key, entry] of bundleCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      entriesToDelete.push(key);
    }
  }

  for (const key of entriesToDelete) {
    bundleCache.delete(key);
  }
}

/**
 * Cached version of bundleMDX that evicts entries older than 10 minutes
 * @param mdx The MDX source string to bundle
 * @param options Optional docsUrl and branch for loader context
 * @returns The bundled MDX code
 * @throws Error if bundling fails
 */
export async function cachedBundleMDX(
  mdx: string,
  options?: {
    docsUrl?: EncodedDocsUrl;
    branch?: string;
  }
): Promise<{ code: string }> {
  // Check cache first without blocking
  const cachedEntry = bundleCache.get(mdx);

  if (cachedEntry && Date.now() - cachedEntry.timestamp <= CACHE_TTL) {
    // Evict stale entries asynchronously
    void Promise.resolve().then(() => evictStaleEntries());

    if (cachedEntry.error) {
      throw new Error(cachedEntry.error);
    }
    return { code: cachedEntry.code };
  }

  // Use batched bundling for cache miss
  return batchedBundleMDX(mdx, options);
}

/**
 * Clears the entire cache
 */
export function clearCache(): void {
  bundleCache.clear();
}

/**
 * Gets the current cache size
 */
export function getCacheSize(): number {
  return bundleCache.size;
}

/* baching stuff */

interface PendingRequest {
  mdx: string;
  resolve: (result: { code: string }) => void;
  reject: (error: Error) => void;
}

interface BatchContext {
  requests: PendingRequest[];
  timer: NodeJS.Timeout;
  options?: {
    docsUrl?: EncodedDocsUrl;
    branch?: string;
  };
}

// Batch collector for requests - now keyed by docsUrl+branch combination
const batchContexts = new Map<string, BatchContext>();
const BATCH_WINDOW_MS = 100;

/**
 * Batched version of bundleMDX that collects requests and processes them together
 * @param mdx The MDX source string to bundle
 * @param options Optional docsUrl and branch for loader context
 * @returns The bundled MDX code
 */
async function batchedBundleMDX(
  mdx: string,
  options?: {
    docsUrl?: EncodedDocsUrl;
    branch?: string;
  }
): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    // Create a key for this batch context
    const batchKey = `${options?.docsUrl ?? "default"}_${options?.branch ?? "default"}`;

    // Get or create batch context
    let context = batchContexts.get(batchKey);

    if (!context) {
      // Create new batch context with timer
      const timer = setTimeout(() => {
        const ctx = batchContexts.get(batchKey);
        if (ctx) {
          batchContexts.delete(batchKey);

          // Process the batch asynchronously
          void Promise.resolve().then(() => {
            processBatch(ctx.requests, ctx.options).catch((error: unknown) => {
              // If batch processing fails entirely, reject all requests
              console.error("Batch processing failed:", error);
              ctx.requests.forEach((req) => {
                req.reject(
                  error instanceof Error ? error : new Error(String(error))
                );
              });
            });
          });
        }
      }, BATCH_WINDOW_MS);

      context = {
        requests: [],
        timer,
        options,
      };
      batchContexts.set(batchKey, context);
    }

    // Add request to batch
    context.requests.push({ mdx, resolve, reject });
  });
}
