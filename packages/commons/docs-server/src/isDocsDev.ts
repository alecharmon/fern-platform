import { isLocal } from "./isLocal";

/**
 * Returns true if running in docs development mode.
 *
 * This is true when:
 * - NEXT_PUBLIC_IS_DOCS_DEV=true (set by `pnpm docs:dev` in fern-platform)
 * - NEXT_PUBLIC_IS_LOCAL=1 (set by `fern docs dev` CLI command)
 *
 * In docs dev mode, we use in-memory caching instead of Next.js's persistent
 * disk-based cache (unstable_cache) to avoid caching failures that can persist
 * across server restarts.
 */
export const isDocsDev = () => {
    return process.env.NEXT_PUBLIC_IS_DOCS_DEV === "true" || isLocal();
};
