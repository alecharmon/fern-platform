import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { ValidateGitRepo } from "@/app/api/validate-git-repo/route";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import type { DocsUrl } from "@/utils/types";

export type { ValidateGitRepo };

export const useValidateGitRepo = ({
    enabled,
    docsUrl,
    gitUrl,
    refetchInterval = false,
    staleTime = 0
}: {
    enabled: boolean;
    docsUrl: DocsUrl;
    gitUrl?: string;
    refetchInterval?: number | false;
    staleTime?: number;
}) => {
    const queryClient = useQueryClient();

    const {
        data: validationResult,
        isLoading,
        isFetching,
        refetch: originalRefetch
    } = useQuery<ValidateGitRepo.Response | null>({
        queryKey: ["git-repo-validation", docsUrl, gitUrl],
        queryFn: async ({ queryKey }) => {
            if (!gitUrl) {
                return null;
            }
            // Check if this is a manual refetch by seeing if forceRefresh is in the query key meta
            // For manual refetches triggered by the user, we want to bypass the cache
            const forceRefresh = (queryKey as string[]).includes("force-refresh");
            return await DashboardApiClient.validateGitRepo({
                url: docsUrl,
                gitUrl,
                forceRefresh
            });
        },
        enabled: enabled && !!gitUrl,
        staleTime,
        retry: false,
        refetchInterval,
        refetchIntervalInBackground: true
    });

    // Wrap refetch to force a cache refresh by invalidating the cache server-side
    const refetch = useCallback(async () => {
        // Invalidate React Query cache first
        await queryClient.invalidateQueries({
            queryKey: ["git-repo-validation", docsUrl, gitUrl]
        });
        // Fetch with forceRefresh flag to invalidate Redis cache
        if (gitUrl) {
            const result = await DashboardApiClient.validateGitRepo({
                url: docsUrl,
                gitUrl,
                forceRefresh: true
            });
            // Update the cache with the fresh result
            queryClient.setQueryData(["git-repo-validation", docsUrl, gitUrl], result);
            return { data: result };
        }
        return originalRefetch();
    }, [docsUrl, gitUrl, queryClient, originalRefetch]);

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({
            queryKey: ["git-repo-validation", docsUrl, gitUrl]
        });
    }, [docsUrl, gitUrl, queryClient]);

    return {
        loading: isLoading,
        fetching: isFetching,
        refetch,
        result: validationResult,
        invalidate
    };
};
