/**
 * Browser-safe runtime configuration for standalone widget
 *
 * For the standalone widget, we always assume:
 * - NOT self-hosted (always use Algolia, not Meilisearch)
 * - No base path (widget is embedded)
 */

export function isSelfHosted(): boolean {
    // Standalone widget always uses Algolia
    return false;
}

export function getBasePath(): string {
    // No base path for standalone widget
    return "";
}
