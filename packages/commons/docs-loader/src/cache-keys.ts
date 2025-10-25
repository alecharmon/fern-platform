/**
 * Shared cache key constants for KV storage.
 * These keys are used across both the docs-loader (reader) and revalidation endpoint (writer).
 *
 * IMPORTANT: Keep these constants in sync to prevent cache key mismatches.
 * Any changes to these keys should be coordinated across:
 * - packages/commons/docs-loader/src/readonly-docs-loader.ts (reader)
 * - packages/fern-docs/bundle/src/app/[host]/[domain]/api/fern-docs/revalidate/route.ts (writer)
 */

/**
 * Cache key for storing metadata about the docs domain
 */
export const CACHE_KEY_METADATA = "metadata";

/**
 * Cache key for storing the navigation root node
 */
export const CACHE_KEY_ROOT = "root";

/**
 * Cache key for storing the docs configuration (without navigation/root)
 */
export const CACHE_KEY_CONFIG = "config";

/**
 * Cache key for storing file data (images, assets, etc.)
 */
export const CACHE_KEY_FILES = "files";

/**
 * Cache key for storing MDX bundler JavaScript files
 */
export const CACHE_KEY_MDX_BUNDLER_FILES = "mdx-bundler-files";

/**
 * Cache key for storing color theme configuration
 */
export const CACHE_KEY_COLORS = "colors";

/**
 * Cache key for storing logo URLs (light and dark mode)
 */
export const CACHE_KEY_LOGO_URLS = "logoUrls";

/**
 * Cache key for storing font configuration
 */
export const CACHE_KEY_FONTS = "fonts";

/**
 * Cache key for storing Ask AI enabled status
 */
export const CACHE_KEY_ASK_AI_ENABLED = "askAiEnabled";

/**
 * Creates a cache key for a specific page by ID
 * @param params - Object containing page identifier
 * @param params.pageId - The page identifier
 * @returns Cache key string in format "page:{pageId}"
 */
export function createPageCacheKey({ pageId }: { pageId: string }): string {
    return `page:${pageId}`;
}

/**
 * Creates a cache key for a specific API definition
 * @param params - Object containing API and endpoint identifiers
 * @param params.apiId - The API definition identifier
 * @param params.endpointKey - The endpoint-specific key (e.g., "endpoint:xyz")
 * @returns Cache key string in format "api:{apiId}:{endpointKey}"
 */
export function createApiCacheKey({ apiId, endpointKey }: { apiId: string; endpointKey: string }): string {
    return `api:${apiId}:${endpointKey}`;
}

/**
 * Creates a cache key for dynamic IR by language
 * @param params - Object containing organization, API name, and config hash
 * @param params.orgId - Organization identifier
 * @param params.apiName - API name
 * @param params.configHash - Configuration hash
 * @returns Cache key string in format "dynamicIr:{orgId}:{apiName}:{configHash}"
 */
export function createDynamicIrCacheKey({
    orgId,
    apiName,
    configHash
}: {
    orgId: string;
    apiName: string;
    configHash: string;
}): string {
    return `dynamicIr:${orgId}:${apiName}:${configHash}`;
}
