/**
 * Cache version for remote-rendered MDX. Bump to invalidate all
 * remote MDX cache entries without affecting the local pipeline.
 *
 * Kept in its own file so that batch-cache-api-descriptions.ts
 * can import it without pulling in batch-serializer.ts's heavy
 * dependency tree (which causes 500s on Vercel API pages).
 */
export const REMOTE_MDX_PIPELINE_VERSION = "1";
