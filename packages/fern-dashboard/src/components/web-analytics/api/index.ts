import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Re-export server actions for direct use with React Query
 *
 * RECOMMENDED: Use getAllAnalytics() for new implementations to fetch all data in one request
 *
 * Usage in components:
 * ```typescript
 * import { useQuery } from "@tanstack/react-query";
 * import { getChannels, ANALYTICS_STALE_TIME } from "../api";
 *
 * const { data, isLoading } = useQuery({
 *   queryKey: ["channels", docsUrl, dateRange, sortState],
 *   queryFn: () => getChannels({ docsUrl, dateRange, limit: 10 }),
 *   staleTime: ANALYTICS_STALE_TIME
 * });
 * ```
 */
export {
    get404Pages,
    getAllAnalytics,
    getAPIExplorerRequests,
    getChannels,
    getDeviceTypes,
    getLLMBotTrafficByProvider,
    getLLMFileViews,
    getPageViewsByDay,
    getReferringDomains,
    getTopCountries,
    getTopPages,
    getVisitorsByDay,
    getWebAnalytics
} from "@/app/actions/getWebAnalytics";

/**
 * Standard stale time for analytics queries (5 minutes)
 * Data is pre-cached in Supabase so safe to cache client-side
 */
export const ANALYTICS_STALE_TIME = 1000 * 60 * 5;

/**
 * Invalidate analytics cache after refresh/update operations
 * Invalidates the unified "all-analytics" query used by AnalyticsDataProvider
 */
export function useInvalidateAnalyticsCache() {
    const queryClient = useQueryClient();

    return useCallback(
        (docsUrl?: string) => {
            if (docsUrl) {
                void queryClient.invalidateQueries({
                    queryKey: ["all-analytics", docsUrl]
                });
            } else {
                void queryClient.invalidateQueries();
            }
        },
        [queryClient]
    );
}
