/**
 * PostHog Analytics Services
 *
 * This module provides a clean separation between HTTP client and business logic:
 * - PostHogClient: Pure HTTP/query execution layer
 * - AnalyticsService: Business logic for specific analytics queries
 */
import { AnalyticsService } from "./analytics";

/**
 * Convenience function to create analytics service
 * This is now just a simple wrapper around createAnalyticsService
 */
export function getAnalyticsService(config: {
    userId: string;
    baseSiteUrl: string;
    additionalDomains?: string[];
    projectId?: string;
    apiUrl?: string;
}) {
    return new AnalyticsService(config);
}

// Alias for backward compatibility
export { getAnalyticsService as createAnalyticsService };

// Re-export types
export type { APIExplorerEndpoint, APIExplorerOptions, DateRangeOptions, TimeSeriesData } from "./types";
